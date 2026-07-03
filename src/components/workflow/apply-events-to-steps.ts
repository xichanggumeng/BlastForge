/**
 * 把 WorkflowEvent[] 增量应用到 WorkflowRun.steps，得到当前可见的步骤状态。
 *
 * 设计：
 * - 服务端 WorkflowEvent 是事件流真实信号；前端只通过事件序列推导节点状态，
 *   不依赖单次连接的最终 Run 快照。
 * - 对未收到事件的 Step 保留 run.steps 中已存在的 status（用于历史 / Replay 视图）。
 * - 同一 step 收到多个事件时按事件顺序覆盖（取最后一次语义合理的状态）。
 *
 * 与 useWorkflowStream / workflow-flow 共用，保证事件驱动视图与回放视图的语义一致。
 */

import type {
  StepStatus,
  WorkflowEvent,
  WorkflowRun,
  WorkflowStepState,
} from '@/modules/agent-runtime/core/contracts';

const FINAL_STEP_STATUSES = new Set<StepStatus>([
  'succeeded',
  'failed',
  'skipped',
  'blocked',
  'warning',
]);

/**
 * 把 WorkflowEvent 序列应用到 Run 的步骤上。
 *
 * 规则（按事件类型）：
 * - step.started         → 对应 step → running
 * - step.completed       → 对应 step → payload.status（若为 blocked/failed/warning 保留，否则 succeeded）
 * - review.blocked       → review_safety → blocked
 * - workflow.completed   → pending/running 步骤 → succeeded
 * - workflow.failed      → pending/running 步骤 → failed
 * - workflow.cancelled   → pending/running 步骤 → skipped
 * - agent.started / tool.* / citation.* / human.* 不直接变更 Step 状态（但保留事件）
 *
 * 终态后不会再被 step.started 覆盖（避免 finished 节点被回滚到 running）。
 */
export function applyEventsToSteps(
  run: WorkflowRun,
  events: readonly WorkflowEvent[],
): WorkflowStepState[] {
  const initial = run.steps.map((s) => ({ ...s }));
  const byStepId = new Map<string, WorkflowStepState>();
  for (const step of initial) {
    byStepId.set(step.stepId, step);
  }

  const terminalRunStatus = detectTerminalRunStatus(events);

  for (const evt of events) {
    if (evt.type === 'step.started') {
      const step = byStepId.get(evt.stepId ?? '');
      if (!step) continue;
      if (FINAL_STEP_STATUSES.has(step.status)) continue;
      step.status = 'running';
      step.startedAt = evt.timestamp;
    } else if (evt.type === 'step.completed') {
      const step = byStepId.get(evt.stepId ?? '');
      if (!step) continue;
      const status = normalizeStatus(evt.payload['status']);
      if (status) {
        step.status = status;
      } else {
        step.status = 'succeeded';
      }
      step.completedAt = evt.timestamp;
      const dur = Number(evt.payload['durationMs'] ?? 0);
      if (dur > 0) step.durationMs = dur;
      const summary = evt.payload['outputSummary'];
      if (typeof summary === 'string') {
        step.outputSummary = summary;
      }
    } else if (evt.type === 'review.blocked') {
      const step = byStepId.get('review_safety');
      if (step) {
        step.status = 'blocked';
        step.completedAt = evt.timestamp;
        const reason = evt.payload['reason'];
        if (typeof reason === 'string') {
          step.errorMessage = reason;
        }
        const codes = evt.payload['ruleCodes'];
        if (Array.isArray(codes) && codes.length > 0) {
          step.errorCode = `RULES:${codes.join(',')}`;
        }
      }
    } else if (evt.type === 'workflow.completed') {
      for (const step of byStepId.values()) {
        if (step.status === 'pending' || step.status === 'running') {
          step.status = 'succeeded';
          step.completedAt = evt.timestamp;
        }
      }
    } else if (evt.type === 'workflow.failed') {
      for (const step of byStepId.values()) {
        if (step.status === 'pending' || step.status === 'running') {
          step.status = 'failed';
          step.completedAt = evt.timestamp;
        }
      }
    } else if (evt.type === 'workflow.cancelled') {
      for (const step of byStepId.values()) {
        if (step.status === 'pending' || step.status === 'running') {
          step.status = 'skipped';
          step.completedAt = evt.timestamp;
        }
      }
    }
  }

  // 在没有 workflow.completed 事件但状态机已经终止（例如仅依赖 review.blocked）
  // 时，按 terminalRunStatus 推一次未完成步骤。
  if (terminalRunStatus) {
    const fill: StepStatus =
      terminalRunStatus === 'blocked'
        ? 'skipped'
        : terminalRunStatus === 'cancelled'
          ? 'skipped'
          : terminalRunStatus === 'failed'
            ? 'failed'
            : 'succeeded';
    for (const step of byStepId.values()) {
      if (step.status === 'pending' || step.status === 'running') {
        step.status = fill;
      }
    }
  }

  return Array.from(byStepId.values()).sort(
    (a, b) => a.stepId.localeCompare(b.stepId),
  );
}

function detectTerminalRunStatus(
  events: readonly WorkflowEvent[],
): 'completed' | 'blocked' | 'failed' | 'cancelled' | null {
  let last: 'completed' | 'blocked' | 'failed' | 'cancelled' | null = null;
  for (const evt of events) {
    if (evt.type === 'workflow.completed') last = 'completed';
    else if (evt.type === 'workflow.failed') last = 'failed';
    else if (evt.type === 'workflow.cancelled') last = 'cancelled';
    else if (evt.type === 'review.blocked') last = 'blocked';
  }
  return last;
}

function normalizeStatus(raw: unknown): StepStatus | null {
  if (typeof raw !== 'string') return null;
  if (
    raw === 'pending' ||
    raw === 'running' ||
    raw === 'succeeded' ||
    raw === 'warning' ||
    raw === 'failed' ||
    raw === 'skipped' ||
    raw === 'blocked'
  ) {
    return raw;
  }
  return null;
}
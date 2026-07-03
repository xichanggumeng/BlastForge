/**
 * 预录制 Run 快照生成器。
 *
 * 把 DemoReplay 数据 + 一个最小化的 BlastScenarioInput 转换为完整的
 * WorkflowRun + WorkflowEvent + FrontendTraceSummary 集合，
 * 用于 Workflow 页面的预录制视图（无需运行真实 Orchestrator）。
 *
 * 这是确定性纯函数，便于测试和 SSG 渲染。
 */

import { fingerprintInput } from '@/modules/parameter-planning/domain/planner';
import {
  blastScenarioInputSchema,
  type BlastScenarioInput,
  type NormalizedParameterSet,
} from '@/modules/parameter-planning/domain/contracts';

import { MAIN_WORKFLOW_STEPS, buildInitialStepStates } from './workflow-engine';
import type {
  Citation,
  FrontendTraceSummary,
  TraceRecord,
  WorkflowEvent,
  WorkflowRun,
  WorkflowStepState,
} from './contracts';
import type { DemoReplay } from './replay';

export interface BuiltReplaySnapshot {
  run: WorkflowRun;
  events: WorkflowEvent[];
  traces: FrontendTraceSummary[];
  input: BlastScenarioInput;
}

let counter = 0;
function nextEventId(): string {
  counter += 1;
  return `evt-replay-${counter}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
function nextTraceId(): string {
  return `trace-replay-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function nowStamp(baseMs: number, offsetMs: number): number {
  return baseMs + offsetMs;
}

function buildSyntheticInput(presetId: string, normalized: NormalizedParameterSet, replay: DemoReplay): BlastScenarioInput {
  const baseInput: BlastScenarioInput = {
    engineeringType: normalized.chargeStructure === 'decked' ? 'tunnel' : 'open-pit-bench',
    rockCategory:
      normalized.protodyakonov >= 10
        ? 'hard'
        : normalized.protodyakonov >= 6
          ? 'medium'
          : 'soft',
    protodyakonov: normalized.protodyakonov,
    jointCondition: 'blocky',
    waterCondition: replay.highRisk ? 'wet' : 'damp',
    constructionEnvironment: replay.highRisk
      ? 'near-sensitive'
      : presetId === 'complex'
        ? 'near-residential'
        : 'open-area',
    protectionTarget: replay.highRisk
      ? 'school'
      : presetId === 'complex'
        ? 'residential'
        : 'none',
    environmentSensitivity: replay.highRisk ? 'high' : 'low',
    costPreference: 'balanced',
    convenienceRequirement: 'medium',
    freeTextNotes: `Replay：${presetId}（${normalized.chargeStructure}）`,
    benchHeight: normalized.benchHeight,
    holeDiameter: normalized.holeDiameter,
    holeDepth: normalized.holeDepth,
    stemmingLength: normalized.stemmingLength,
    peakParticleVelocity: normalized.peakParticleVelocity,
    flyrockRisk: replay.highRisk ? 'high' : 'low',
  };
  return blastScenarioInputSchema.parse(baseInput);
}

function buildStepStatesForReplay(replay: DemoReplay, baseMs: number): WorkflowStepState[] {
  const initial = buildInitialStepStates();
  return initial.map((s, idx) => {
    if (replay.highRisk) {
      // 高风险：review_safety 阻断
      if (s.stepId === 'review_safety') {
        return {
          ...s,
          status: 'blocked',
          startedAt: nowStamp(baseMs, idx * 480),
          completedAt: nowStamp(baseMs, idx * 480 + 360),
          durationMs: 360,
          outputSummary: 'Safety Reviewer 阻断：单响药量超阈值、振速 v>1.0 cm/s',
          errorCode: 'WORKFLOW_BLOCKED',
          errorMessage: 'Safety Reviewer 阻断：单响药量超阈值、振速 v>1.0 cm/s',
        };
      }
      if (s.stepId === 'human_approval') {
        return {
          ...s,
          status: 'skipped',
          startedAt: nowStamp(baseMs, idx * 480),
          completedAt: nowStamp(baseMs, idx * 480 + 80),
          durationMs: 80,
          outputSummary: '被阻断，跳过人工审批',
        };
      }
      if (s.stepId === 'generate_report') {
        return {
          ...s,
          status: 'skipped',
          startedAt: nowStamp(baseMs, idx * 480),
          completedAt: nowStamp(baseMs, idx * 480 + 80),
          durationMs: 80,
        };
      }
    }
    return {
      ...s,
      status: 'succeeded',
      startedAt: nowStamp(baseMs, idx * 480),
      completedAt: nowStamp(baseMs, idx * 480 + 320 + idx * 12),
      durationMs: 320 + idx * 12,
      outputSummary:
        idx === 1
          ? '已生成标准化参数（线性装药 / 孔距 / 排距 / 单响药量等）'
          : idx === 2
            ? `已检索 ${replay.citations.length} 条规范 / 教材 / 案例引用`
            : idx === 3
              ? `已识别 ${replay.ruleIssues.length} 条规则项`
              : idx === 4
                ? '已生成方案骨架 + 敏感性矩阵'
                : idx === 5
                  ? `已生成 ${replay.schemes.length || 3} 个候选方案`
                  : idx === 6
                    ? '已计算安全 / 适用 / 经济 / 便捷 / 环境分项评分'
                    : idx === 7
                      ? 'Safety Reviewer 通过'
                      : idx === 8
                        ? '人工审批通过（Demo 模式默认批准）'
                        : idx === 9
                          ? '报告大纲已生成'
                          : undefined,
    };
  });
}

function buildEvents(replay: DemoReplay, runId: string, baseMs: number): WorkflowEvent[] {
  const events: WorkflowEvent[] = [];
  let seq = 0;

  const make = (
    type: WorkflowEvent['type'],
    offsetMs: number,
    stepId: string,
    payload: Record<string, unknown>,
    extras: { agentId?: string; toolCallId?: string } = {},
  ): void => {
    seq += 1;
    events.push({
      eventId: nextEventId(),
      sequence: seq,
      type,
      runId,
      workflowId: 'wf-parameter-planning',
      timestamp: nowStamp(baseMs, offsetMs),
      stepId,
      payload: payload as never,
      ...(extras.agentId ? { agentId: extras.agentId } : {}),
      ...(extras.toolCallId ? { toolCallId: extras.toolCallId } : {}),
    });
  };

  const model = 'deepseek-v4-pro';

  // workflow.started
  make('workflow.started', 0, 'validate_input', { workflowId: 'wf-parameter-planning', replay: true, model });

  // 10 个步骤各 start / agent / tool / complete
  MAIN_WORKFLOW_STEPS.forEach((step, idx) => {
    const baseOffset = idx * 480 + 80;
    make('step.started', baseOffset, step.stepId, { stepId: step.stepId, stepLabel: step.label, agentId: step.agentId });

    // agent.started
    if (step.agentId) {
      make('agent.started', baseOffset + 20, step.stepId, {
        agentId: step.agentId,
        agentName: step.agentId,
        mode: 'structured',
        promptVersion: 'v1.0.0',
      }, { agentId: step.agentId });
    }

    // tool 调用：取每个 step 第一个 tool 名（如有）
    const toolName = step.toolName;
    if (toolName) {
      const toolCallId = `tool-replay-${idx}-${Math.floor(Math.random() * 1e6).toString(36)}`;
      make('tool.called', baseOffset + 80, step.stepId, {
        toolCallId,
        toolName,
        agentId: step.agentId,
      }, { toolCallId });
      const dur = 120 + idx * 8;
      make('tool.completed', baseOffset + 80 + dur, step.stepId, {
        toolCallId,
        toolName,
        durationMs: dur,
        success: true,
      }, { toolCallId });
    }

    // citation（仅 retrieve_knowledge）
    if (step.stepId === 'retrieve_knowledge') {
      replay.citations.forEach((c, cIdx) => {
        make('citation.attached', baseOffset + 200 + cIdx * 30, step.stepId, {
          citationId: c.id,
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          category: c.category,
          score: c.score,
          excerpt: c.excerpt,
        });
      });
    }

    // review_safety
    if (step.stepId === 'review_safety') {
      if (replay.highRisk) {
        make('review.blocked', baseOffset + 240, step.stepId, {
          reason: 'Safety Reviewer 阻断：单响药量超阈值、振速 v>1.0 cm/s',
          ruleCodes: replay.ruleIssues.filter((i) => i.severity === 'danger').map((i) => i.code),
        });
      }
    }

    // human_approval
    if (step.stepId === 'human_approval') {
      if (replay.highRisk) {
        // 被阻断，跳过
      } else {
        make('human.input_requested', baseOffset + 200, step.stepId, {
          stepId: 'human_approval',
          prompt: 'Safety Reviewer 已通过；请人工确认是否进入报告生成。',
        });
        make('human.approved', baseOffset + 260, step.stepId, {
          stepId: 'human_approval',
          approver: 'demo-user',
          comment: 'Demo 模式默认批准；生产环境必须人工签字。',
        });
      }
    }

    make('step.completed', baseOffset + 320 + idx * 12, step.stepId, {
      stepId: step.stepId,
      status: replay.highRisk && (step.stepId === 'review_safety' || step.stepId === 'human_approval' || step.stepId === 'generate_report')
        ? (step.stepId === 'review_safety' ? 'blocked' : 'skipped')
        : 'succeeded',
      durationMs: 320 + idx * 12,
    });
  });

  if (replay.highRisk) {
    seq += 1;
    events.push({
      eventId: nextEventId(),
      sequence: seq,
      type: 'workflow.completed',
      runId,
      workflowId: 'wf-parameter-planning',
      timestamp: nowStamp(baseMs, MAIN_WORKFLOW_STEPS.length * 480 + 200),
      payload: { status: 'completed', replay: true, durationMs: 0 },
    });
  } else {
    seq += 1;
    events.push({
      eventId: nextEventId(),
      sequence: seq,
      type: 'workflow.completed',
      runId,
      workflowId: 'wf-parameter-planning',
      timestamp: nowStamp(baseMs, MAIN_WORKFLOW_STEPS.length * 480 + 200),
      payload: { status: 'completed', replay: true, durationMs: 0 },
    });
  }

  return events;
}

function buildTraces(replay: DemoReplay, runId: string, requestId: string, baseMs: number): FrontendTraceSummary[] {
  const out: FrontendTraceSummary[] = [];
  MAIN_WORKFLOW_STEPS.forEach((step, idx) => {
    if (!step.agentId) return;
    const startedAt = nowStamp(baseMs, idx * 480 + 80);
    const completedAt = nowStamp(baseMs, idx * 480 + 320 + idx * 12);
    const status: FrontendTraceSummary['status'] =
      replay.highRisk && step.stepId === 'review_safety'
        ? 'blocked'
        : replay.highRisk && (step.stepId === 'human_approval' || step.stepId === 'generate_report')
          ? 'skipped'
          : 'succeeded';
    const trace: TraceRecord = {
      id: nextTraceId(),
      requestId,
      runId,
      workflowId: 'wf-parameter-planning',
      stepId: step.stepId,
      agentId: step.agentId,
      model: 'deepseek-v4-pro',
      mode: 'non-thinking',
      promptVersion: 'v1.0.0',
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      status: status === 'blocked' || status === 'skipped' ? 'succeeded' : status,
    };
    out.push({
      id: trace.id,
      runId: trace.runId,
      stepId: trace.stepId,
      agentId: trace.agentId,
      model: trace.model,
      mode: trace.mode,
      promptVersion: trace.promptVersion,
      startedAt: trace.startedAt,
      completedAt: trace.completedAt,
      durationMs: trace.durationMs,
      status,
    });
  });
  return out;
}

export function buildReplaySnapshot(presetId: string, replay: DemoReplay): BuiltReplaySnapshot {
  const baseMs = Date.parse('2026-07-04T09:00:00.000Z');
  const runId = `replay-run-${presetId}`;
  const requestId = `replay-req-${presetId}`;
  const input = buildSyntheticInput(presetId, replay.normalized, replay);

  const stepStates = buildStepStatesForReplay(replay, baseMs);
  const events = buildEvents(replay, runId, baseMs);
  const traces = buildTraces(replay, runId, requestId, baseMs);

  const recommendedSchemeId = replay.highRisk ? undefined : replay.schemes[0]?.id ?? undefined;

  const run: WorkflowRun = {
    id: runId,
    workflowId: 'wf-parameter-planning',
    presetId,
    fingerprint: fingerprintInput(input),
    status: replay.highRisk ? 'blocked' : 'completed',
    steps: stepStates,
    outputSummary: {
      schemeCount: replay.schemes.length || 3,
      recommendedSchemeId,
      riskCount: replay.ruleIssues.filter((i) => i.severity === 'danger').length,
      reviewCount: replay.ruleIssues.filter((i) => i.severity === 'warning').length,
      notes: replay.highRisk
        ? 'Replay: Safety Reviewer 阻断流程'
        : 'Replay: 常规 / 复杂流程已生成推荐 / 备选 / 风险方案',
    },
    replay: true,
    createdAt: new Date(baseMs).toISOString(),
    startedAt: new Date(baseMs).toISOString(),
    completedAt: new Date(baseMs + MAIN_WORKFLOW_STEPS.length * 480 + 220).toISOString(),
    ...(replay.highRisk ? { blockedReason: 'Safety Reviewer 阻断：单响药量超阈值、振速 v>1.0 cm/s' } : {}),
  };

  return {
    run,
    events,
    traces,
    input,
  };
}

export function buildCitationsFromReplay(replay: DemoReplay): Citation[] {
  return replay.citations.map((c) => ({ ...c }));
}
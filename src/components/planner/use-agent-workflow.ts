'use client';

/**
 * Agent Workflow 桥接 Hook：
 * - 把 Planner Workbench 的"启动规划"动作代理到服务端 Agent Runtime；
 * - 服务端不可用 / 网络失败 / 返回非 JSON 时自动回退到 planDemo 纯函数；
 * - 期间持续接收 WorkflowEvent 流，驱动本地执行步骤；
 * - 最终输出适配 Planner 现有 PlanningRun 结构，保证工作台不破。
 *
 * 用法：
 *   const { state, start, cancel } = useAgentWorkflow();
 *   start({ presetId: 'standard', input });
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import {
  planDemo,
  PLANNING_STEPS,
  type PlanningPipelineInput,
  type PlanningRun,
  type PlanningStepEvent,
  type PlanningStepId,
  type PlanningStepStatus,
} from '@/modules/parameter-planning/domain';
import type {
  Citation,
  FrontendTraceSummary,
  WorkflowEvent,
  WorkflowRun,
} from '@/modules/agent-runtime/core/contracts';

export type AgentExecutionPhase =
  | 'idle'
  | 'connecting'
  | 'running'
  | 'fallback'
  | 'cancelling'
  | 'cancelled'
  | 'failed'
  | 'done';

export interface AgentExecutionState {
  phase: AgentExecutionPhase;
  steps: PlanningStepEvent[];
  run: PlanningRun | null;
  agentRunId: string | null;
  replay: boolean;
  events: WorkflowEvent[];
  traces: FrontendTraceSummary[];
  citations: Citation[];
  error: string | null;
}

export interface UseAgentWorkflowOptions {
  stepDurationMs?: number;
}

export interface UseAgentWorkflowResult {
  state: AgentExecutionState;
  start: (input: { presetId?: string; input: PlanningPipelineInput['input'] }) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

function initialSteps(): PlanningStepEvent[] {
  return PLANNING_STEPS.map((s) => ({ id: s.id, label: s.label, status: 'pending' as PlanningStepStatus }));
}

function statusForStep(id: PlanningStepId, workflowRun: WorkflowRun): PlanningStepStatus {
  if (workflowRun.status === 'blocked') {
    if (id === 'review_safety' || id === 'await_human_review') return 'blocked';
    if (id === 'validate_input' || id === 'normalize_parameters' || id === 'run_rule_precheck' ||
        id === 'plan_parameters' || id === 'generate_schemes' || id === 'calculate_scores') return 'succeeded';
    return 'skipped';
  }
  return 'succeeded';
}

function syncStepStatus(steps: PlanningStepEvent[], id: PlanningStepId, status: PlanningStepStatus): PlanningStepEvent[] {
  return steps.map((s) => (s.id === id ? { ...s, status } : s));
}

function nextAgentPhaseFromEvent(
  prev: AgentExecutionPhase,
  evt: WorkflowEvent,
): AgentExecutionPhase {
  if (prev === 'fallback') return prev;
  if (evt.type === 'workflow.failed') return 'failed';
  if (evt.type === 'workflow.completed') return 'done';
  if (evt.type === 'review.blocked') return 'done';
  return 'running';
}

function finalStepStatusFromRun(id: PlanningStepId, run: WorkflowRun): PlanningStepStatus {
  if (run.status === 'blocked') {
    if (id === 'review_safety' || id === 'await_human_review') return 'blocked';
    if (id === 'validate_input' || id === 'normalize_parameters' || id === 'run_rule_precheck' ||
        id === 'plan_parameters' || id === 'generate_schemes' || id === 'calculate_scores') return 'succeeded';
    return 'skipped';
  }
  return 'succeeded';
}

const STEP_PLANNER_MAP: Record<string, PlanningStepId> = {
  validate_input: 'validate_input',
  normalize_parameters: 'normalize_parameters',
  retrieve_knowledge: 'normalize_parameters',
  run_rule_precheck: 'run_rule_precheck',
  plan_parameters: 'plan_parameters',
  generate_schemes: 'generate_schemes',
  calculate_scores: 'calculate_scores',
  review_safety: 'review_safety',
  human_approval: 'await_human_review',
  generate_report: 'await_human_review',
};

export function useAgentWorkflow(options: UseAgentWorkflowOptions = {}): UseAgentWorkflowResult {
  const { stepDurationMs = 360 } = options;

  const [state, setState] = useState<AgentExecutionState>({
    phase: 'idle',
    steps: initialSteps(),
    run: null,
    agentRunId: null,
    replay: false,
    events: [],
    traces: [],
    citations: [],
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const fallbackTimerRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    for (const t of fallbackTimerRef.current) clearTimeout(t);
    fallbackTimerRef.current = [];
    setState((prev) => ({
      ...prev,
      phase: prev.phase === 'running' ? 'cancelling' : prev.phase,
      steps: prev.steps.map((s) => (s.status === 'running' ? { ...s, status: 'skipped' } : s)),
    }));
    if (state.agentRunId && state.agentRunId.length > 0) {
      void fetch(`/api/agent/runs/${encodeURIComponent(state.agentRunId)}`, { method: 'DELETE' }).catch(() => undefined);
    }
    setState((prev) => ({
      ...prev,
      phase: 'cancelled',
    }));
  }, [state.agentRunId]);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    for (const t of fallbackTimerRef.current) clearTimeout(t);
    fallbackTimerRef.current = [];
    setState({
      phase: 'idle',
      steps: initialSteps(),
      run: null,
      agentRunId: null,
      replay: false,
      events: [],
      traces: [],
      citations: [],
      error: null,
    });
  }, []);

  const fallbackRun = useCallback(
    (req: { presetId?: string; input: PlanningPipelineInput['input'] }) => {
      setState((prev) => ({ ...prev, phase: 'fallback' }));
      let snapshot: PlanningRun;
      try {
        const out = planDemo({ input: req.input, presetId: req.presetId ?? undefined });
        snapshot = out.run;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Demo 引擎失败';
        setState((prev) => ({ ...prev, phase: 'failed', error: message }));
        return;
      }

      const seq: Array<ReturnType<typeof setTimeout>> = fallbackTimerRef.current;
      setState((prev) => ({
        ...prev,
        run: snapshot,
        replay: true,
        steps: snapshot.steps.map((s) => ({ ...s, status: 'pending' })),
      }));

      PLANNING_STEPS.forEach((s, idx) => {
        const t1 = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            steps: syncStepStatus(prev.steps, s.id, 'running'),
          }));
        }, idx * stepDurationMs);
        const t2 = setTimeout(() => {
          setState((prev) => {
            const target = snapshot.steps.find((r) => r.id === s.id);
            const status: PlanningStepStatus = statusForStep(s.id, { status: target?.status ?? 'completed' } as WorkflowRun);
            return {
              ...prev,
              steps: syncStepStatus(prev.steps, s.id, status),
            };
          });
        }, idx * stepDurationMs + stepDurationMs - 80);
        seq.push(t1, t2);
      });

      const final = setTimeout(() => {
        setState((prev) => ({ ...prev, phase: 'done' }));
      }, PLANNING_STEPS.length * stepDurationMs + 100);
      seq.push(final);
    },
    [stepDurationMs],
  );

  const start = useCallback(
    async (req: { presetId?: string; input: PlanningPipelineInput['input'] }) => {
      reset();
      setState((prev) => ({ ...prev, phase: 'connecting' }));

      const abort = new AbortController();
      abortRef.current = abort;

      const params = new URLSearchParams();
      if (req.presetId) params.set('preset', req.presetId);
      params.set('input', JSON.stringify(req.input));

      let receivedEvents = 0;

      try {
        const res = await fetch(`/api/agent/runs/stream?${params.toString()}`, {
          signal: abort.signal,
          headers: { Accept: 'text/event-stream' },
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/event-stream')) {
          throw new Error('Non-SSE response');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let runId: string | null = null;
        let replayFlag = false;

        const processEvent = (data: unknown): void => {
          if (!data || typeof data !== 'object') return;
          const evt = data as WorkflowEvent;
          receivedEvents += 1;
          if (!runId && typeof evt.runId === 'string') runId = evt.runId;
          if (evt.payload && typeof evt.payload === 'object') {
            const p = evt.payload as Record<string, unknown>;
            if (p['replay'] === true) replayFlag = true;
          }

          if (evt.stepId) {
            const plannerStep = STEP_PLANNER_MAP[evt.stepId];
            if (plannerStep) {
              setState((prev) => {
                if (evt.type === 'step.started') {
                  return {
                    ...prev,
                    steps: syncStepStatus(prev.steps, plannerStep, 'running'),
                  };
                }
                if (evt.type === 'step.completed') {
                  const status = evt.payload['status'] === 'blocked' ? 'blocked' : 'succeeded';
                  return {
                    ...prev,
                    steps: syncStepStatus(prev.steps, plannerStep, status),
                  };
                }
                if (evt.type === 'review.blocked') {
                  return {
                    ...prev,
                    steps: syncStepStatus(prev.steps, 'review_safety', 'blocked'),
                  };
                }
                return prev;
              });
            }
          }

          setState((prev) => {
            const nextPhase = nextAgentPhaseFromEvent(prev.phase, evt);
            return {
              ...prev,
              phase: nextPhase,
              events: [...prev.events, evt],
              agentRunId: runId ?? prev.agentRunId,
              replay: prev.replay || replayFlag,
            };
          });
        };

        while (!abort.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              try {
                const parsed: unknown = JSON.parse(payload);
                processEvent(parsed);
              } catch {
                // 忽略非法行
              }
            }
          }
        }

        if (receivedEvents === 0) {
          throw new Error('No events received');
        }

        // 流结束后查询 run 取最终 PlanningRun
        if (runId) {
          try {
            const finalRes = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}`, {
              signal: abort.signal,
              cache: 'no-store',
            });
            const finalJson = (await finalRes.json()) as {
              success: boolean;
              data?: { run: WorkflowRun; events: WorkflowEvent[]; traces: FrontendTraceSummary[] };
            };
            if (finalJson.success && finalJson.data) {
              const convertRes = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}/convert`, {
                method: 'POST',
                signal: abort.signal,
              });
              if (convertRes.ok) {
                const convertJson = (await convertRes.json()) as { success: boolean; data?: { planningRun: PlanningRun } };
                if (convertJson.success && convertJson.data) {
                  setState((prev) => ({
                    ...prev,
                    run: convertJson.data!.planningRun,
                    phase: prev.phase === 'cancelled' ? 'cancelled' : prev.phase === 'running' ? 'done' : prev.phase,
                    steps: prev.steps.map((s) => ({ ...s, status: finalStepStatusFromRun(s.id, finalJson.data!.run) })),
                  }));
                  return;
                }
              }
            }
          } catch {
            // 忽略，触发本地 fallback
          }
        }

        throw new Error('Stream ended without final result');
      } catch {
        if (abort.signal.aborted) {
          setState((prev) => ({ ...prev, phase: 'cancelled' }));
          return;
        }
        fallbackRun(req);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reset, stepDurationMs, fallbackRun],
  );

  return useMemo(() => ({ state, start, cancel, reset }), [state, start, cancel, reset]);
}
'use client';

/**
 * Workflow 页面专用 SSE Hook —— 把 /api/agent/runs/stream 的事件流解析为 React 可消费状态。
 *
 * 设计目标：
 * - 不依赖单次连接保存唯一结果：组件卸载或断线后，仍可调用 cancel / reset，
 *   并通过 fetchRunFallback 拉取 run 最终状态恢复视图。
 * - 事件类型严格按服务端 Route Handler 约定（meta / workflow.event / workflow.summary / workflow.failed）。
 * - 解析失败 / 网络失败均落入 error 状态，让上层组件明确告知用户；不静默吞错。
 *
 * 与 Planner 的 useAgentWorkflow 不同：本 Hook 只暴露 Workflow 视图所需字段，
 * 不做 PlanningRun 适配（适配由 WorkflowFlow 完成）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Citation,
  FrontendTraceSummary,
  WorkflowEvent,
  WorkflowRun,
} from '@/modules/agent-runtime/core/contracts';

export type WorkflowStreamPhase =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'done'
  | 'cancelled'
  | 'failed';

export interface WorkflowStreamMeta {
  runId: string;
  replay: boolean;
  model: string;
  providerAvailable: boolean;
  demoReplayEnabled: boolean;
}

export interface WorkflowStreamError {
  code: string;
  message: string;
}

export interface WorkflowStreamState {
  phase: WorkflowStreamPhase;
  meta: WorkflowStreamMeta | null;
  events: WorkflowEvent[];
  run: WorkflowRun | null;
  traces: FrontendTraceSummary[];
  citations: Citation[];
  /** 来自 WorkflowEvent 流的实时 blocked 信息（用于在 workflow.summary 之前高亮）。 */
  blockedSignal: {
    stepId: string;
    reason: string;
    ruleCodes: readonly string[];
    timestamp: number;
  } | null;
  error: WorkflowStreamError | null;
}

export interface UseWorkflowStreamResult {
  state: WorkflowStreamState;
  start: (req: {
    presetId: 'standard' | 'complex' | 'high-risk';
    input: unknown;
    replay: boolean;
  }) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

function emptyState(): WorkflowStreamState {
  return {
    phase: 'idle',
    meta: null,
    events: [],
    run: null,
    traces: [],
    citations: [],
    blockedSignal: null,
    error: null,
  };
}

function isWorkflowEvent(value: unknown): value is WorkflowEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['eventId'] === 'string' && typeof v['type'] === 'string';
}

export interface ProcessLineDeps {
  setMeta: (meta: WorkflowStreamMeta) => void;
  appendEvent: (evt: WorkflowEvent) => void;
  setBlockedSignal: (
    signal: WorkflowStreamState['blockedSignal'],
  ) => void;
  setSummary: (
    run: WorkflowRun,
    traces: FrontendTraceSummary[],
    replay: boolean,
  ) => void;
  setError: (code: string, message: string) => void;
}

/**
 * 解析单条 `data: ...` 行；导出供测试。调用方负责传入 setState 包装的 deps。
 * 返回是否成功消费了本行（用于上层统计 receivedEvents）。
 */
export function processLine(raw: string, deps: ProcessLineDeps): boolean {
  const line = raw.trim();
  if (!line.startsWith('data:')) return false;
  const payload = line.slice(5).trim();
  if (!payload) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object') return false;
  const obj = parsed as Record<string, unknown>;
  const kind = obj['type'];

  if (kind === 'meta') {
    const meta: WorkflowStreamMeta = {
      runId: String(obj['runId'] ?? ''),
      replay: obj['replay'] === true,
      model: String(obj['model'] ?? ''),
      providerAvailable: obj['providerAvailable'] === true,
      demoReplayEnabled: obj['demoReplayEnabled'] === true,
    };
    deps.setMeta(meta);
    return true;
  }

  if (kind === 'workflow.event' && isWorkflowEvent(obj['event'])) {
    const evt = obj['event'];
    deps.appendEvent(evt);
    if (evt.type === 'review.blocked' && evt.stepId) {
      deps.setBlockedSignal({
        stepId: evt.stepId,
        reason: String(evt.payload['reason'] ?? ''),
        ruleCodes: Array.isArray(evt.payload['ruleCodes'])
          ? (evt.payload['ruleCodes'] as string[])
          : [],
        timestamp: evt.timestamp,
      });
    }
    return true;
  }

  if (kind === 'workflow.summary') {
    const summaryRun = obj['run'] as WorkflowRun | undefined;
    const summaryTraces = Array.isArray(obj['traces'])
      ? (obj['traces'] as FrontendTraceSummary[])
      : [];
    const summaryReplay = obj['replay'] === true;
    if (summaryRun) {
      deps.setSummary(summaryRun, summaryTraces, summaryReplay);
    }
    return true;
  }

  if (kind === 'workflow.failed') {
    deps.setError(
      String(obj['code'] ?? 'WORKFLOW_FAILED'),
      String(obj['message'] ?? 'Workflow 执行失败'),
    );
    return true;
  }

  if (kind === 'error') {
    deps.setError(
      String(obj['code'] ?? 'STREAM_ERROR'),
      String(obj['message'] ?? '流式接口返回错误'),
    );
    return true;
  }

  return false;
}

/** 内部别名，保留向后兼容旧测试导入路径。 */
export const __test__processLine = processLine;

export function useWorkflowStream(): UseWorkflowStreamResult {
  const [state, setState] = useState<WorkflowStreamState>(emptyState);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState((prev) =>
      prev.phase === 'streaming' || prev.phase === 'connecting'
        ? { ...prev, phase: 'cancelled' }
        : prev,
    );
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState(emptyState());
  }, []);

  const start = useCallback(
    async (req: {
      presetId: 'standard' | 'complex' | 'high-risk';
      input: unknown;
      replay: boolean;
    }) => {
      // 清理上一次连接
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const abort = new AbortController();
      abortRef.current = abort;

      setState({
        ...emptyState(),
        phase: 'connecting',
      });

      const params = new URLSearchParams();
      params.set('preset', req.presetId);
      params.set('input', JSON.stringify(req.input));
      params.set('replay', req.replay ? '1' : '0');

      let receivedEvents = 0;

      try {
        const res = await fetch(
          `/api/agent/runs/stream?${params.toString()}`,
          {
            signal: abort.signal,
            headers: { Accept: 'text/event-stream' },
          },
        );

        if (!res.ok || !res.body) {
          throw Object.assign(new Error(`HTTP ${res.status}`), {
            code: `HTTP_${res.status}`,
          });
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/event-stream')) {
          throw Object.assign(new Error('Non-SSE response'), {
            code: 'NON_SSE_RESPONSE',
          });
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const consume = (raw: string): void => {
          if (!raw.trim().startsWith('data:')) return;
          processLine(raw, {
            setMeta: (meta) =>
              setState((prev) => ({ ...prev, meta, phase: 'streaming' })),
            appendEvent: (evt) => {
              receivedEvents += 1;
              setState((prev) => ({ ...prev, events: [...prev.events, evt] }));
            },
            setBlockedSignal: (blockedSignal) =>
              setState((prev) => ({ ...prev, blockedSignal })),
            setSummary: (run, traces, replay) => {
              receivedEvents += 1;
              setState((prev) => ({
                ...prev,
                run,
                traces,
                replay: replay || prev.meta?.replay === true,
                phase: abort.signal.aborted ? 'cancelled' : 'done',
              }));
            },
            setError: (code, message) =>
              setState((prev) => ({ ...prev, phase: 'failed', error: { code, message } })),
          });
        };

        while (!abort.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf('\n\n');
          while (idx >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = chunk.split('\n');
            for (const line of lines) consume(line);
            idx = buffer.indexOf('\n\n');
          }
        }

        // 流结束后尝试从 Repository 恢复最终状态
        if (receivedEvents === 0 && !abort.signal.aborted) {
          throw Object.assign(new Error('No events received'), {
            code: 'NO_EVENTS',
          });
        }

        setState((prev) => {
          const meta = prev.meta;
          if (!meta?.runId || abort.signal.aborted) return prev;
          // 异步恢复最终状态
          void (async () => {
            try {
              const finalRes = await fetch(
                `/api/agent/runs/${encodeURIComponent(meta.runId)}`,
                { signal: abort.signal, cache: 'no-store' },
              );
              const finalJson = (await finalRes.json()) as {
                success: boolean;
                data?: {
                  run: WorkflowRun;
                  events: WorkflowEvent[];
                  traces: FrontendTraceSummary[];
                };
              };
              if (finalJson.success && finalJson.data) {
                const fallbackCitations = collectCitationsFromEvents(
                  finalJson.data.events,
                );
                setState((p) => ({
                  ...p,
                  run: finalJson.data!.run,
                  traces: finalJson.data!.traces,
                  events:
                    p.events.length > 0 ? p.events : finalJson.data!.events,
                  citations:
                    p.citations.length > 0
                      ? p.citations
                      : fallbackCitations,
                  phase: p.phase === 'streaming' ? 'done' : p.phase,
                }));
              }
            } catch {
              // 恢复失败不阻断当前 UI
            }
          })();
          return prev;
        });
      } catch (err) {
        if (abort.signal.aborted) {
          setState((prev) =>
            prev.phase === 'streaming' || prev.phase === 'connecting'
              ? { ...prev, phase: 'cancelled' }
              : prev,
          );
          return;
        }
        const e = err as { code?: string; message?: string };
        setState((prev) => ({
          ...prev,
          phase: 'failed',
          error: {
            code: e.code ?? 'STREAM_ERROR',
            message:
              e.message ?? 'Workflow 流式接口连接失败；请稍后重试或选择预录制 Run。',
          },
        }));
      } finally {
        if (abortRef.current === abort) {
          abortRef.current = null;
        }
      }
    },
    // state.meta 已在 start 内部通过 setState((prev) => ...) 读取最新值，无需列入依赖
    [],
  );

  // 组件卸载时自动中止，避免泄漏 AbortController
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  return useMemo(
    () => ({ state, start, cancel, reset }),
    [state, start, cancel, reset],
  );
}

function collectCitationsFromEvents(
  events: readonly WorkflowEvent[],
): Citation[] {
  const out: Citation[] = [];
  for (const evt of events) {
    if (evt.type === 'citation.attached') {
      out.push({
        id: String(evt.payload['citationId'] ?? `cit-${evt.sequence}`),
        documentId: String(evt.payload['documentId'] ?? ''),
        documentTitle: String(evt.payload['documentTitle'] ?? ''),
        category: String(evt.payload['category'] ?? ''),
        score: Number(evt.payload['score'] ?? 0),
        excerpt: String(evt.payload['excerpt'] ?? ''),
      });
    }
  }
  return out;
}
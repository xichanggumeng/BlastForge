/**
 * Trace Recorder —— 安全的运行时 Trace。
 *
 * 关键约束：
 * - 记录：requestId / runId / workflowId / stepId / agentId / toolCallId / model / mode /
 *   promptVersion / startedAt / completedAt / duration / status / errorCode；
 * - 不记录 API Key / 系统 Prompt 全文 / 隐藏思维过程；
 * - 前端通过 getTraceSummaryForFrontend 获得脱敏后的 Trace 列表；
 * - 所有方法 server-only。
 */

import "server-only";

import type {
  AgentMode,
  FrontendTraceSummary,
  TraceRecord,
  TraceStatus,
} from "./contracts";

let sequenceCounter = 0;

function nextTraceId(): string {
  sequenceCounter = (sequenceCounter + 1) >>> 0;
  return `trace-${Date.now().toString(36)}-${sequenceCounter.toString(36)}`;
}

class TraceRecorder {
  private store = new Map<string, TraceRecord[]>();
  /** requestId → 关联 trace 列表（前端不可见，仅供 service 内部） */
  private byRequest = new Map<string, Set<string>>();

  start(opts: {
    requestId: string;
    runId: string;
    workflowId: string;
    stepId: string;
    agentId?: string;
    toolCallId?: string;
    projectId?: string;
    scenarioId?: string;
    model: string;
    mode: AgentMode;
    promptVersion: string;
  }): TraceRecord {
    const rec: TraceRecord = {
      id: nextTraceId(),
      requestId: opts.requestId,
      runId: opts.runId,
      workflowId: opts.workflowId,
      stepId: opts.stepId,
      model: opts.model,
      mode: opts.mode,
      promptVersion: opts.promptVersion,
      startedAt: Date.now(),
      status: "running",
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
      ...(opts.toolCallId ? { toolCallId: opts.toolCallId } : {}),
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.scenarioId ? { scenarioId: opts.scenarioId } : {}),
    };
    const list = this.store.get(opts.runId) ?? [];
    list.push(rec);
    this.store.set(opts.runId, list);
    const reqSet = this.byRequest.get(opts.requestId) ?? new Set<string>();
    reqSet.add(rec.id);
    this.byRequest.set(opts.requestId, reqSet);
    return rec;
  }

  finish(traceId: string, status: TraceStatus, errorCode?: string): TraceRecord | undefined {
    const rec = this.findById(traceId);
    if (!rec) return undefined;
    const completedAt = Date.now();
    rec.completedAt = completedAt;
    rec.durationMs = completedAt - rec.startedAt;
    rec.status = status;
    if (errorCode) rec.errorCode = errorCode;
    return rec;
  }

  get(traceId: string): TraceRecord | undefined {
    return this.findById(traceId);
  }

  listByRun(runId: string): readonly TraceRecord[] {
    return this.store.get(runId) ?? [];
  }

  listByRequest(requestId: string): readonly TraceRecord[] {
    const ids = this.byRequest.get(requestId);
    if (!ids) return [];
    const result: TraceRecord[] = [];
    for (const list of this.store.values()) {
      for (const rec of list) {
        if (ids.has(rec.id)) result.push(rec);
      }
    }
    return result;
  }

  private findById(id: string): TraceRecord | undefined {
    for (const list of this.store.values()) {
      const rec = list.find((r) => r.id === id);
      if (rec) return rec;
    }
    return undefined;
  }
}

let singleton: TraceRecorder | null = null;

export function getTraceRecorder(): TraceRecorder {
  if (!singleton) singleton = new TraceRecorder();
  return singleton;
}

export function __resetTraceRecorderForTests(): void {
  singleton = null;
}

export function toFrontendSummary(rec: TraceRecord): FrontendTraceSummary {
  return {
    id: rec.id,
    runId: rec.runId,
    stepId: rec.stepId,
    model: rec.model,
    mode: rec.mode,
    promptVersion: rec.promptVersion,
    startedAt: rec.startedAt,
    ...(rec.agentId ? { agentId: rec.agentId } : {}),
    ...(rec.toolCallId ? { toolCallId: rec.toolCallId } : {}),
    ...(rec.completedAt !== undefined ? { completedAt: rec.completedAt } : {}),
    ...(rec.durationMs !== undefined ? { durationMs: rec.durationMs } : {}),
    ...(rec.errorCode ? { errorCode: rec.errorCode } : {}),
    status: rec.status,
  };
}

export function listTraceSummariesForRun(runId: string): readonly FrontendTraceSummary[] {
  return getTraceRecorder()
    .listByRun(runId)
    .map(toFrontendSummary);
}

export type { FrontendTraceSummary };
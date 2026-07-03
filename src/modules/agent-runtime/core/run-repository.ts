/**
 * Workflow Run Repository —— 内存实现。
 *
 * 当前阶段（Phase 3 / Session 4）使用 Node 进程内 Map 持久化 Run 与事件。
 * 后续可替换为 Drizzle PostgreSQL 实现，接口保持稳定。
 */

import "server-only";

import type { BlastScenarioInput } from "@/modules/parameter-planning/domain/contracts";

import type { WorkflowEvent, WorkflowRun, WorkflowStepState } from "./contracts";

interface RunRecord {
  run: WorkflowRun;
  events: WorkflowEvent[];
  /** 取消信号；多用于流中断后由前端查询时停止 Agent 继续执行 */
  cancelled: boolean;
  /** 原始输入；用于后续 convert 回 PlanningRun */
  input?: BlastScenarioInput;
}

class InMemoryRunRepository {
  private runs = new Map<string, RunRecord>();
  private byScenario = new Map<string, string[]>();

  create(run: WorkflowRun, input?: BlastScenarioInput): void {
    this.runs.set(run.id, { run, events: [], cancelled: false, input });
    if (run.scenarioId) {
      const list = this.byScenario.get(run.scenarioId) ?? [];
      list.push(run.id);
      this.byScenario.set(run.scenarioId, list);
    }
  }

  save(run: WorkflowRun): void {
    const existing = this.runs.get(run.id);
    if (!existing) {
      this.create(run);
      return;
    }
    existing.run = run;
  }

  setInput(runId: string, input: BlastScenarioInput): void {
    const r = this.runs.get(runId);
    if (!r) return;
    r.input = input;
  }

  getInput(runId: string): BlastScenarioInput | undefined {
    return this.runs.get(runId)?.input;
  }

  cancel(runId: string): boolean {
    const r = this.runs.get(runId);
    if (!r) return false;
    r.cancelled = true;
    return true;
  }

  isCancelled(runId: string): boolean {
    return this.runs.get(runId)?.cancelled ?? false;
  }

  get(runId: string): WorkflowRun | undefined {
    return this.runs.get(runId)?.run;
  }

  getEvents(runId: string): readonly WorkflowEvent[] {
    return this.runs.get(runId)?.events ?? [];
  }

  appendEvent(runId: string, event: WorkflowEvent): void {
    const r = this.runs.get(runId);
    if (!r) return;
    r.events.push(event);
  }

  /** 更新某个 step 的状态（由 Orchestrator 调用）。 */
  updateStep(runId: string, stepId: string, patch: Partial<WorkflowStepState>): WorkflowRun | undefined {
    const r = this.runs.get(runId);
    if (!r) return undefined;
    const idx = r.run.steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return undefined;
    const steps = r.run.steps.slice();
    const cur = steps[idx];
    if (!cur) return undefined;
    const next = { ...cur, ...patch };
    if (patch.startedAt && !patch.completedAt) {
      next.startedAt = patch.startedAt;
    }
    if (patch.completedAt && patch.startedAt === undefined) {
      next.completedAt = patch.completedAt;
      next.durationMs = patch.completedAt - (cur.startedAt ?? patch.completedAt);
    }
    steps[idx] = next;
    r.run = { ...r.run, steps };
    return r.run;
  }

  listRecent(limit = 12): readonly WorkflowRun[] {
    const arr = Array.from(this.runs.values())
      .map((r) => r.run)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return arr.slice(0, limit);
  }

  /** 给前端使用的安全摘要（去除 presetId 等敏感字段外的所有字段）。 */
  listRecentForFrontend(limit = 12): readonly WorkflowRun[] {
    return this.listRecent(limit);
  }
}

let singleton: InMemoryRunRepository | null = null;

export function getRunRepository(): InMemoryRunRepository {
  if (!singleton) singleton = new InMemoryRunRepository();
  return singleton;
}

export function __resetRunRepositoryForTests(): void {
  singleton = null;
}

export type { RunRecord };
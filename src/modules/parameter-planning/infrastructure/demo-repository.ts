/**
 * 参数规划 - 内存 Repository（Demo / 测试默认）。
 *
 * 数据持久化在 Node 内存中，跨请求可通过 Next.js cache 与 persist 模式保留。
 * Drizzle / PostgreSQL 版本在本阶段暂未启用，仅保留 Repository 接口。
 */

import type {
  BlastScenarioInput,
  ScenarioPreset,
} from "../domain/contracts";
import type { PlanningPipelineInput } from "../domain/planner";
import { planDemo } from "../domain/planner";
import { SCENARIO_PRESETS } from "../domain/presets";
import type {
  PlanningRepository,
  PlanningRunRecord,
  ScenarioRecord,
} from "./repository";

const initialSeed = (): { scenarios: Map<string, ScenarioRecord>; runs: Map<string, PlanningRunRecord> } => {
  const scenarios = new Map<string, ScenarioRecord>();
  const runs = new Map<string, PlanningRunRecord>();

  /** 注入初始 3 条预设场景的快照，使其初次访问就有数据可看 */
  SCENARIO_PRESETS.slice(0, 3).forEach((preset, idx) => {
    const scenarioId = `scn-${preset.id}-seed`;
    const scenario: ScenarioRecord = {
      id: scenarioId,
      name: preset.name,
      presetId: preset.id,
      input: preset.input,
      createdAt: `2026-07-04T0${idx + 1}:00:00+08:00`,
      updatedAt: `2026-07-04T0${idx + 1}:30:00+08:00`,
    };
    scenarios.set(scenario.id, scenario);
  });

  return { scenarios, runs };
};

class InMemoryPlanningRepository implements PlanningRepository {
  private state = initialSeed();
  private counter = 0;

  listPresets(): readonly ScenarioPreset[] {
    return SCENARIO_PRESETS;
  }

  listRecentScenarios(limit = 6): readonly ScenarioRecord[] {
    const arr = Array.from(this.state.scenarios.values()).sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    );
    return arr.slice(0, limit);
  }

  async createPlanningRun(input: PlanningPipelineInput): Promise<PlanningRunRecord> {
    const scenarioId = input.presetId
      ? `scn-${input.presetId}-${++this.counter}`
      : `scn-adhoc-${++this.counter}`;

    const scenario: ScenarioRecord = {
      id: scenarioId,
      name: input.presetId ? presetName(input.presetId) : "自定义场景",
      presetId: input.presetId,
      input: input.input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.state.scenarios.set(scenario.id, scenario);

    const pipeline = planDemo(input);
    const record: PlanningRunRecord = {
      id: pipeline.run.id,
      scenarioId,
      status: pipeline.run.status,
      run: pipeline.run,
      createdAt: pipeline.run.createdAt,
    };
    this.state.runs.set(record.id, record);
    return record;
  }

  async rerunPlanning(
    scenarioId: string,
    input: BlastScenarioInput,
  ): Promise<PlanningRunRecord> {
    const existing = this.state.scenarios.get(scenarioId);
    if (!existing) {
      throw new Error(`未找到场景：${scenarioId}`);
    }
    const updated: ScenarioRecord = {
      ...existing,
      input,
      updatedAt: nowIso(),
    };
    this.state.scenarios.set(scenarioId, updated);

    const pipeline = planDemo({
      input,
      projectId: existing.presetId,
      presetId: existing.presetId,
      simulatedNowIso: updated.updatedAt,
    });
    const record: PlanningRunRecord = {
      id: pipeline.run.id,
      scenarioId,
      status: pipeline.run.status,
      run: pipeline.run,
      createdAt: pipeline.run.createdAt,
    };
    this.state.runs.set(record.id, record);
    return record;
  }

  listPlanningRuns(limit = 6): readonly PlanningRunRecord[] {
    const arr = Array.from(this.state.runs.values()).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
    return arr.slice(0, limit);
  }

  getRunById(runId: string): PlanningRunRecord | undefined {
    return this.state.runs.get(runId);
  }

  /** 测试钩子：重置内部状态 */
  __resetForTests(): void {
    this.state = initialSeed();
    this.counter = 0;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function presetName(presetId: string): string {
  return presetId === "standard"
    ? "常规规划场景"
    : presetId === "complex"
      ? "复杂约束场景"
      : "高风险拦截场景";
}

/** 全局单例 */
let singleton: InMemoryPlanningRepository | null = null;

export function getDemoPlanningRepository(): PlanningRepository {
  if (!singleton) {
    singleton = new InMemoryPlanningRepository();
  }
  return singleton;
}

/** 仅测试用 */
export function __resetDemoRepositoryForTests(): void {
  if (singleton) singleton.__resetForTests();
}

/** 导出一个工厂，便于测试或 SSR 重置 */
export function createInMemoryPlanningRepository(): PlanningRepository {
  return new InMemoryPlanningRepository();
}

/** 重新导出 planDemo 便于测试 */
export { planDemo as runPlanDemo };

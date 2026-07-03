/**
 * 参数规划模块 - 数据访问层接口。
 *
 * 设计原则：
 * - Repository 接口在演示阶段由内存版（在 demo 仓库）和未来数据库版（Drizzle PostgreSQL）实现；
 * - Provider 选择按 `DATABASE_URL` 与 `DEMO_REPOSITORY` 环境变量切换；
 * - 当前阶段（无 DATABASE_URL）使用 DemoRepository，业务 UI 不会感知差异。
 */

import type {
  BlastScenarioInput,
  PlanningRun,
  ScenarioPreset,
} from "../domain/contracts";
import type { PlanningPipelineInput } from "../domain/planner";

export interface ScenarioRecord {
  id: string;
  name: string;
  presetId?: string;
  /** 原始输入，可以为空字符串（占位记录） */
  input: BlastScenarioInput;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningRunRecord {
  id: string;
  scenarioId: string;
  status: string;
  run: PlanningRun;
  createdAt: string;
}

/**
 * 参数规划 Repository 接口。
 * 数据库适配与 Demo 适配均实现该接口。
 */
export interface PlanningRepository {
  /** 列出预设场景（永远返回静态常量） */
  listPresets(): readonly ScenarioPreset[];

  /** 列出最近 Run / 场景记录 */
  listRecentScenarios(limit?: number): readonly ScenarioRecord[];

  /** 保存场景输入并触发规划 */
  createPlanningRun(input: PlanningPipelineInput): Promise<PlanningRunRecord>;

  /** 重新规划（基于已有场景 id 与 input） */
  rerunPlanning(scenarioId: string, input: BlastScenarioInput): Promise<PlanningRunRecord>;

  /** 列出 Run */
  listPlanningRuns(limit?: number): readonly PlanningRunRecord[];

  /** 按 id 获取 */
  getRunById(runId: string): PlanningRunRecord | undefined;
}

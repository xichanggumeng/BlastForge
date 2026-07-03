/**
 * 爆破参数预测与方案规划 - 业务规则与常量。
 *
 * 这里集中存放所有可被纯函数复用的规则常量与映射表，
 * 不允许出现任何 React / DOM / IO 相关代码。
 */

import {
  type BlastScenarioInput,
  type CostPreference,
  type EnvironmentSensitivity,
  type EngineeringType,
  type ProtectionTarget,
  type RockCategory,
  type WaterCondition,
  type ConstructionEnvironment,
  ENGINEERING_TYPES,
  ROCK_CATEGORIES,
} from "../domain/contracts";

/** 工程类型显示名 */
export const ENGINEERING_TYPE_LABEL: Record<EngineeringType, string> = {
  "open-pit-bench": "露天深孔台阶",
  tunnel: "隧道掘进",
  "underground-cavern": "地下硐室",
  "urban-excavation": "城市基坑",
  demolition: "拆除爆破",
};

/** 岩体类别显示名 */
export const ROCK_CATEGORY_LABEL: Record<RockCategory, string> = {
  soft: "软岩",
  "medium-soft": "中软岩",
  medium: "中硬岩",
  "medium-hard": "中硬偏硬岩",
  hard: "硬岩",
  "very-hard": "坚硬岩",
};

/** 施工环境显示名 */
export const CONSTRUCTION_ENV_LABEL: Record<ConstructionEnvironment, string> = {
  "open-area": "开阔场地",
  "near-residential": "近居民区",
  "near-industrial": "近工业区",
  "near-sensitive": "近敏感设施",
  confined: "受限空间",
};

/** 周边保护对象显示名 */
export const PROTECTION_LABEL: Record<ProtectionTarget, string> = {
  none: "无",
  residential: "居民建筑",
  school: "学校",
  hospital: "医院",
  utility: "管线设施",
  heritage: "历史建筑",
  wildlife: "生态敏感区",
};

/** 含水情况显示名 */
export const WATER_LABEL: Record<WaterCondition, string> = {
  dry: "干燥",
  damp: "潮湿",
  wet: "含水",
  saturated: "饱水",
};

/** 节理裂隙显示名（仅展示用映射可后续追加） */
export const JOINT_LABEL: Record<BlastScenarioInput["jointCondition"], string> = {
  massive: "整体块状",
  blocky: "块状",
  fractured: "碎裂",
  "highly-fractured": "破碎",
  weathered: "风化",
};

/** 成本倾向显示名 */
export const COST_LABEL: Record<CostPreference, string> = {
  strict: "严格控制成本",
  balanced: "成本与安全平衡",
  premium: "优先安全允许更高成本",
};

/** 环境敏感度显示名 */
export const SENSITIVITY_LABEL: Record<EnvironmentSensitivity, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

/** 施工便利性显示名 */
export const CONVENIENCE_LABEL: Record<BlastScenarioInput["convenienceRequirement"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

/** 普氏系数典型范围对照（f 值在岩体类别上的典型区间）。用于在没有输入普氏系数时给出默认值 */
export const ROCK_F_RANGE: Record<RockCategory, { min: number; max: number; typical: number }> = {
  soft: { min: 1, max: 3, typical: 2 },
  "medium-soft": { min: 3, max: 5, typical: 4 },
  medium: { min: 5, max: 8, typical: 6.5 },
  "medium-hard": { min: 8, max: 12, typical: 10 },
  hard: { min: 12, max: 16, typical: 14 },
  "very-hard": { min: 16, max: 20, typical: 18 },
};

/** 风险等级排序辅助 */
export function rankEngineeringTypeOrder(): readonly EngineeringType[] {
  return ENGINEERING_TYPES;
}

export function rankRockOrder(): readonly RockCategory[] {
  return ROCK_CATEGORIES;
}

/** 给定输入，映射回岩体类别（用于从普氏系数反推） */
export function inferRockCategoryFromF(f: number): RockCategory {
  if (f < 3) return "soft";
  if (f < 5) return "medium-soft";
  if (f < 8) return "medium";
  if (f < 12) return "medium-hard";
  if (f < 16) return "hard";
  return "very-hard";
}

/** 普氏系数 → 一些基础特征值。索引保持确定性 */
export function describeRockByF(f: number): { stiffness: number; brittleness: number } {
  const clamped = Math.max(1, Math.min(20, f));
  return {
    stiffness: clamped / 20,
    brittleness: 0.4 + 0.6 * (clamped / 20),
  };
}

/** 将普氏系数换算为大致的岩石密度 (kg/m³)，仅用于 Demo 计算 */
export function estimateRockDensity(f: number): number {
  const { stiffness } = describeRockByF(f);
  return 2300 + stiffness * 700;
}

/** 孔径默认 (mm) - 当用户没填时 */
export function defaultHoleDiameter(engineering: EngineeringType): number {
  if (engineering === "tunnel") return 76;
  if (engineering === "demolition") return 64;
  if (engineering === "urban-excavation") return 89;
  return 138;
}

/** 台阶高度默认值 */
export function defaultBenchHeight(engineering: EngineeringType): number {
  if (engineering === "tunnel") return 4;
  if (engineering === "demolition") return 2.5;
  if (engineering === "urban-excavation") return 6;
  return 12;
}

/** 堵塞长度默认值 */
export function defaultStemmingLength(engineering: EngineeringType): number {
  if (engineering === "tunnel") return 1.2;
  if (engineering === "demolition") return 0.8;
  if (engineering === "urban-excavation") return 1.6;
  return 3.0;
}

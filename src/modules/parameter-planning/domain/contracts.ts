/**
 * 爆破参数预测与方案规划模块 - 领域契约。
 *
 * 严格区分：
 * - input:        用户/表单原值
 * - normalized:   归一化后的标准值
 * - rule:         规则修正后的值
 * - model:        模型（DeepSeek）建议占位值
 * - human:        人工确认值
 * - final:        最终进入报告的值
 *
 * 本阶段不使用模型，PredictedParameter.source 允许标注为 model-placeholder，
 * 方便会话 4 接入 DeepSeek Provider Adapter 时直接替换数据来源。
 */

import { z } from "zod";

/** ---------- 工程类型 / 岩体 / 风险等级枚举 ---------- */

export const ENGINEERING_TYPES = [
  "open-pit-bench",
  "tunnel",
  "underground-cavern",
  "urban-excavation",
  "demolition",
] as const;
export type EngineeringType = (typeof ENGINEERING_TYPES)[number];

export const ROCK_CATEGORIES = [
  "soft",
  "medium-soft",
  "medium",
  "medium-hard",
  "hard",
  "very-hard",
] as const;
export type RockCategory = (typeof ROCK_CATEGORIES)[number];

export const JOINT_CONDITIONS = [
  "massive",
  "blocky",
  "fractured",
  "highly-fractured",
  "weathered",
] as const;
export type JointCondition = (typeof JOINT_CONDITIONS)[number];

export const WATER_CONDITIONS = ["dry", "damp", "wet", "saturated"] as const;
export type WaterCondition = (typeof WATER_CONDITIONS)[number];

export const CONSTRUCTION_ENVIRONMENTS = [
  "open-area",
  "near-residential",
  "near-industrial",
  "near-sensitive",
  "confined",
] as const;
export type ConstructionEnvironment = (typeof CONSTRUCTION_ENVIRONMENTS)[number];

export const PROTECTION_TARGETS = [
  "none",
  "residential",
  "school",
  "hospital",
  "utility",
  "heritage",
  "wildlife",
] as const;
export type ProtectionTarget = (typeof PROTECTION_TARGETS)[number];

export const ENVIRONMENT_SENSITIVITIES = ["low", "medium", "high"] as const;
export type EnvironmentSensitivity = (typeof ENVIRONMENT_SENSITIVITIES)[number];

export const COST_PREFERENCES = ["strict", "balanced", "premium"] as const;
export type CostPreference = (typeof COST_PREFERENCES)[number];

export const CONVENIENCE_REQUIREMENTS = ["low", "medium", "high"] as const;
export type ConvenienceRequirement = (typeof CONVENIENCE_REQUIREMENTS)[number];

/** ---------- Zod Schemas ---------- */

const trimmedString = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(max));

export const engineeringTypeSchema = z.enum(ENGINEERING_TYPES);
export const rockCategorySchema = z.enum(ROCK_CATEGORIES);
export const jointConditionSchema = z.enum(JOINT_CONDITIONS);
export const waterConditionSchema = z.enum(WATER_CONDITIONS);
export const constructionEnvironmentSchema = z.enum(CONSTRUCTION_ENVIRONMENTS);
export const protectionTargetSchema = z.enum(PROTECTION_TARGETS);
export const environmentSensitivitySchema = z.enum(ENVIRONMENT_SENSITIVITIES);
export const costPreferenceSchema = z.enum(COST_PREFERENCES);
export const convenienceRequirementSchema = z.enum(CONVENIENCE_REQUIREMENTS);

/** 普氏硬度系数 f：1~20 区间 */
const protodfakonovRange = z
  .number({ message: "请输入普氏系数" })
  .min(1, "普氏系数最小为 1")
  .max(20, "普氏系数最大为 20");

/** 台阶高度 / 孔深 / 堵塞长度等可正负数（均为正，单位米） */
const positiveMeters = (max: number) =>
  z
    .number({ message: "请输入有效数值" })
    .positive("数值必须大于 0")
    .max(max, `数值超出允许上限 ${max}`);

/** 允许振速（cm/s） */
const peakParticleVelocity = z
  .number({ message: "请输入允许振速" })
  .min(0.1, "允许振速过低")
  .max(20, "允许振速过高");

/** ---------- 场景输入契约 ---------- */

export const blastScenarioInputSchema = z.object({
  /** 工程类型（必填） */
  engineeringType: engineeringTypeSchema,
  /** 岩体类别（必填） */
  rockCategory: rockCategorySchema,
  /** 普氏硬度系数 f （Demo 模拟参数） */
  protodyakonov: protodfakonovRange,
  /** 节理裂隙情况 */
  jointCondition: jointConditionSchema,
  /** 炮孔含水情况 */
  waterCondition: waterConditionSchema,
  /** 施工环境 */
  constructionEnvironment: constructionEnvironmentSchema,
  /** 周边保护对象 */
  protectionTarget: protectionTargetSchema,
  /** 环境敏感度 */
  environmentSensitivity: environmentSensitivitySchema,
  /** 成本倾向 */
  costPreference: costPreferenceSchema,
  /** 施工便利性要求 */
  convenienceRequirement: convenienceRequirementSchema,
  /** 自然语言补充说明（Demo 字段，可选） */
  freeTextNotes: trimmedString(800).optional().default(""),

  /** ---- Demo / 模拟参数（标记为 Demo，规则校验时可放宽） ---- */
  /** 台阶高度（m），可选；不填时由归一化规则给出建议 */
  benchHeight: positiveMeters(60).optional(),
  /** 孔径（mm） */
  holeDiameter: z
    .number({ message: "请输入孔径" })
    .min(50, "孔径过小")
    .max(450, "孔径过大")
    .optional(),
  /** 孔深（m） */
  holeDepth: positiveMeters(80).optional(),
  /** 堵塞长度（m） */
  stemmingLength: positiveMeters(15).optional(),
  /** 目标块度（cm） */
  targetFragmentation: z.number().min(5).max(200).optional(),
  /** 允许振速（cm/s），用于高风险场景 */
  peakParticleVelocity: peakParticleVelocity.optional(),
  /** 飞石风险等级（人工评估） */
  flyrockRisk: z.enum(["low", "medium", "high"]).default("medium"),
});

export type BlastScenarioInput = z.input<typeof blastScenarioInputSchema>;
export type BlastScenarioInputResolved = z.output<typeof blastScenarioInputSchema>;

/** ---------- 标准化参数 ---------- */

export interface NormalizedParameterSet {
  /** 工程类型（标准化文本） */
  engineeringTypeLabel: string;
  /** 岩体类别（标准化文本） */
  rockCategoryLabel: string;
  /** 普氏硬度，用于规则决策 */
  protodyakonov: number;
  /** 台阶高度（m），若无输入则使用推荐值（rule 标记） */
  benchHeight: number;
  /** 孔径（mm） */
  holeDiameter: number;
  /** 孔深（m） */
  holeDepth: number;
  /** 堵塞长度（m） */
  stemmingLength: number;
  /** 孔距 a（m） */
  holeSpacing: number;
  /** 排距 b（m） */
  rowSpacing: number;
  /** 最小抵抗线 w（m） */
  burdenDistance: number;
  /** 装药结构（耦合 / 间隔 / 不耦合） */
  chargeStructure: "coupled" | "decked" | "decoupled";
  /** 装药集中度 q（kg/m），估算 */
  linearChargeDensity: number;
  /** 最大单响药量（kg） */
  maxChargePerDelay: number;
  /** 总装药量（kg） */
  totalChargeKg: number;
  /** 允许振速（cm/s），用于振动预测 */
  peakParticleVelocity: number;
}

/** ---------- 规则预检查结果 ---------- */

export const RULE_SEVERITIES = ["info", "warning", "danger"] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export interface RuleCheckIssue {
  /** 问题 code（用于稳定追踪） */
  code: string;
  /** 业务描述 */
  message: string;
  severity: RuleSeverity;
  /** 关联的参数 key（如 holeSpacing / stemmingLength） */
  paramKey?: string;
  /** 建议动作描述 */
  advice?: string;
}

/** ---------- 方案相关 ---------- */

export const SCHEME_CATEGORIES = [
  "recommended",
  "alternative",
  "risk",
] as const;
export type SchemeCategory = (typeof SCHEME_CATEGORIES)[number];

/** 单一方案参数摘要（多维评分对比） */
export interface SchemeParameterSummary {
  /** 参数 key */
  key: string;
  /** 参数显示标签 */
  label: string;
  /** 数值（保留原始单位） */
  value: number;
  /** 单位 */
  unit: string;
}

/** 方案多维评分（0-100，数字越大越优） */
export interface SchemeScore {
  /** 安全性评分 */
  safety: number;
  /** 适用性评分（与工程条件匹配度） */
  suitability: number;
  /** 经济性评分 */
  economy: number;
  /** 施工便利性评分 */
  convenience: number;
  /** 环境影响评分 */
  environment: number;
  /** 综合评分（加权平均） */
  overall: number;
}

export interface PredictedParameter {
  key: string;
  label: string;
  value: number;
  unit: string;
  range: { min: number; max: number };
  source: "input" | "rule" | "model" | "human";
  /** 该来源的内部细分（用于 session 4 接入 model 时的占位）：
   *  - "input": 用户原值
   *  - "rule": 归一化 / 规则修正
   *  - "model-placeholder": 当前 session 的占位，会话 4 替换为 model
   *  - "human": 人工确认
   */
  sourceKind: "input" | "rule" | "model-placeholder" | "human";
  confidenceLevel: "low" | "medium" | "high";
  rationale: string;
  /** 高风险参数需要人工复核 */
  requiresReview: boolean;
}

export interface Scheme {
  id: string;
  category: SchemeCategory;
  label: string;
  /** 简短标签（展示用） */
  tag: string;
  /** 适用条件描述 */
  applicability: string;
  /** 参数摘要（用于柱状/雷达） */
  parameterSummary: readonly SchemeParameterSummary[];
  /** 参数预测（含来源/置信度/复核标记） */
  predictedParameters: readonly PredictedParameter[];
  /** 多维评分 */
  score: SchemeScore;
  /** 风险列表 */
  risks: readonly string[];
  /** 关键说明 */
  note?: string;
}

/** ---------- 风险项 ---------- */

export interface RiskItem {
  id: string;
  level: "low" | "medium" | "high";
  title: string;
  description: string;
  /** 关联方案 id，可选 */
  schemeId?: string;
  /** 关联参数 key，可选 */
  paramKey?: string;
}

/** ---------- 人工复核项 ---------- */

export interface ReviewRequirement {
  id: string;
  /** 关联的参数 / 方案 */
  paramKey?: string;
  schemeId?: string;
  /** 为什么需要复核 */
  reason: string;
  /** 风险等级 */
  level: "low" | "medium" | "high";
}

/** ---------- 方案推荐汇总 ---------- */

export interface SchemeSet {
  schemes: readonly Scheme[];
  /** 推荐方案 id */
  recommendedId: string;
  /** 备选方案 id 列表 */
  alternativeIds: readonly string[];
  /** 风险 / 不推荐方案 id 列表 */
  riskIds: readonly string[];
}

/** ---------- 规划运行 ---------- */

export type PlanningStepId =
  | "validate_input"
  | "normalize_parameters"
  | "run_rule_precheck"
  | "plan_parameters"
  | "generate_schemes"
  | "calculate_scores"
  | "review_safety"
  | "await_human_review"
  | "finalize";

export type PlanningStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "warning"
  | "failed"
  | "blocked"
  | "skipped";

export interface PlanningStepEvent {
  id: PlanningStepId;
  status: PlanningStepStatus;
  /** 步骤业务描述 */
  label: string;
  /** 起止时间戳 */
  startedAt?: number;
  completedAt?: number;
  detail?: string;
}

export type PlanningRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "succeeded"
  | "awaiting_review"
  | "blocked"
  | "cancelled"
  | "failed";

/** 参数敏感性矩阵条目 */
export interface SensitivityCell {
  parameterKey: string;
  /** -3..+3 微调幅度（百分位 *100） */
  delta: number;
  /** 引起的关键输出变化（这里采用综合评分） */
  outputDelta: number;
}

export interface SensitivityMatrix {
  axes: readonly string[];
  cells: readonly SensitivityCell[];
}

export interface PlanningRun {
  id: string;
  /** 关联项目 id（Demo 数据） */
  projectId?: string;
  /** 关联预设场景 id */
  presetId?: string;
  /** 原始输入 */
  input: BlastScenarioInput;
  /** 标准化结果 */
  normalized: NormalizedParameterSet;
  /** 规则预检查结果 */
  ruleIssues: readonly RuleCheckIssue[];
  /** 方案集合 */
  schemeSet: SchemeSet;
  /** 风险列表 */
  risks: readonly RiskItem[];
  /** 需人工确认项 */
  reviews: readonly ReviewRequirement[];
  /** 敏感性分析 */
  sensitivity: SensitivityMatrix;
  /** 步骤事件 */
  steps: readonly PlanningStepEvent[];
  /** 当前整体状态 */
  status: PlanningRunStatus;
  /** 当前选中方案 id */
  selectedSchemeId: string;
  /** 阻塞原因（status === 'blocked' 时存在） */
  blockedReason?: string;
  createdAt: string;
  completedAt?: string;
}

/** ---------- 预设场景 ---------- */

export const SCENARIO_PRESET_IDS = [
  "standard",
  "complex",
  "high-risk",
] as const;
export type ScenarioPresetId = (typeof SCENARIO_PRESET_IDS)[number];

export interface ScenarioPreset {
  id: ScenarioPresetId;
  name: string;
  shortLabel: string;
  description: string;
  /** 用于能力展示 */
  highlight: readonly string[];
  input: BlastScenarioInput;
}

/** ---------- 风险等级 / Source / 标签静态文案 ---------- */

export const SOURCE_LABEL: Record<PredictedParameter["sourceKind"], string> = {
  input: "用户原值",
  rule: "规则归一",
  "model-placeholder": "模型建议（占位）",
  human: "人工确认",
};

export const CONFIDENCE_LABEL: Record<PredictedParameter["confidenceLevel"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

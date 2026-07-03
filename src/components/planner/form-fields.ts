/**
 * 工程场景表单 - 字段元数据集中处。
 *
 * 字段维护：
 * - 必填 / 选填；
 * - 中文标签；
 * - 字段说明；
 * - 单 位；
 * - 默认值；
 * - 下拉枚举；
 */

import type { BlastScenarioInput } from "@/modules/parameter-planning/domain";

export interface FieldOption<T extends string> {
  value: T;
  label: string;
}

export type InputFieldKey =
  | "engineeringType"
  | "rockCategory"
  | "protodyakonov"
  | "jointCondition"
  | "waterCondition"
  | "constructionEnvironment"
  | "protectionTarget"
  | "environmentSensitivity"
  | "costPreference"
  | "convenienceRequirement"
  | "freeTextNotes"
  | "benchHeight"
  | "holeDiameter"
  | "holeDepth"
  | "stemmingLength"
  | "targetFragmentation"
  | "peakParticleVelocity"
  | "flyrockRisk";

export interface FieldMeta {
  key: InputFieldKey;
  /** 字段类别 */
  group: "scenario" | "env" | "cost" | "demo";
  label: string;
  description?: string;
  unit?: string;
  required: boolean;
  placeholder?: string;
  /** Demo 模拟字段标记 */
  isDemo?: boolean;
  /** 例外地区提示 */
  tip?: string;
}

export const FORM_GROUPS: ReadonlyArray<{
  key: FieldMeta["group"];
  label: string;
  description: string;
}> = [
  {
    key: "scenario",
    label: "工程场景",
    description: "工程类型、岩体与水文条件，决定基础参数。",
  },
  {
    key: "env",
    label: "环境与保护",
    description: "周边保护对象、环境敏感度，决定安全约束。",
  },
  {
    key: "cost",
    label: "施工倾向",
    description: "成本倾向与施工便利性，影响评分权重。",
  },
  {
    key: "demo",
    label: "Demo 模拟参数",
    description: "仅用于 Demo 展示的参数；不影响安全边界。",
  },
];

export const ENGINEERING_OPTIONS: FieldOption<NonNullable<BlastScenarioInput["engineeringType"]>>[] = [
  { value: "open-pit-bench", label: "露天深孔台阶" },
  { value: "tunnel", label: "隧道掘进" },
  { value: "underground-cavern", label: "地下硐室" },
  { value: "urban-excavation", label: "城市基坑" },
  { value: "demolition", label: "拆除爆破" },
];

export const ROCK_OPTIONS: FieldOption<NonNullable<BlastScenarioInput["rockCategory"]>>[] = [
  { value: "soft", label: "软岩" },
  { value: "medium-soft", label: "中软岩" },
  { value: "medium", label: "中硬岩" },
  { value: "medium-hard", label: "中硬偏硬" },
  { value: "hard", label: "硬岩" },
  { value: "very-hard", label: "坚硬岩" },
];

export const JOINT_OPTIONS: FieldOption<NonNullable<BlastScenarioInput["jointCondition"]>>[] = [
  { value: "massive", label: "整体块状" },
  { value: "blocky", label: "块状" },
  { value: "fractured", label: "碎裂" },
  { value: "highly-fractured", label: "破碎" },
  { value: "weathered", label: "风化" },
];

export const WATER_OPTIONS: FieldOption<NonNullable<BlastScenarioInput["waterCondition"]>>[] = [
  { value: "dry", label: "干燥" },
  { value: "damp", label: "潮湿" },
  { value: "wet", label: "含水" },
  { value: "saturated", label: "饱水" },
];

export const ENVIRONMENT_OPTIONS: FieldOption<
  NonNullable<BlastScenarioInput["constructionEnvironment"]>
>[] = [
  { value: "open-area", label: "开阔场地" },
  { value: "near-residential", label: "近居民区" },
  { value: "near-industrial", label: "近工业区" },
  { value: "near-sensitive", label: "近敏感设施" },
  { value: "confined", label: "受限空间" },
];

export const PROTECTION_OPTIONS: FieldOption<
  NonNullable<BlastScenarioInput["protectionTarget"]>
>[] = [
  { value: "none", label: "无" },
  { value: "residential", label: "居民建筑" },
  { value: "school", label: "学校" },
  { value: "hospital", label: "医院" },
  { value: "utility", label: "管线设施" },
  { value: "heritage", label: "历史建筑" },
  { value: "wildlife", label: "生态敏感区" },
];

export const SENSITIVITY_OPTIONS: FieldOption<
  NonNullable<BlastScenarioInput["environmentSensitivity"]>
>[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

export const COST_OPTIONS: FieldOption<NonNullable<BlastScenarioInput["costPreference"]>>[] = [
  { value: "strict", label: "严格控制成本" },
  { value: "balanced", label: "成本与安全平衡" },
  { value: "premium", label: "优先安全" },
];

export const CONVENIENCE_OPTIONS: FieldOption<
  NonNullable<BlastScenarioInput["convenienceRequirement"]>
>[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

export const FLYROCK_OPTIONS: FieldOption<NonNullable<BlastScenarioInput["flyrockRisk"]>>[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

/** 集中字段元数据（顺序固定） */
export const FORM_FIELDS: readonly FieldMeta[] = [
  {
    key: "engineeringType",
    group: "scenario",
    label: "工程类型",
    description: "决定默认值与装药结构基线。",
    required: true,
  },
  {
    key: "rockCategory",
    group: "scenario",
    label: "岩体类别",
    description: "用于映射普氏系数典型值。",
    required: true,
  },
  {
    key: "protodyakonov",
    group: "scenario",
    label: "岩石硬度（普氏系数 f）",
    description: "普氏系数越高，单孔装药越密集。",
    unit: "无量纲",
    required: true,
    placeholder: "例如：8",
    tip: "常规区间 1~20；超出范围将无法提交。",
  },
  {
    key: "jointCondition",
    group: "scenario",
    label: "节理裂隙情况",
    description: "影响孔距系数与堵塞长度。",
    required: true,
  },
  {
    key: "waterCondition",
    group: "scenario",
    label: "炮孔含水情况",
    description: "决定耦合 vs 不耦合装药结构。",
    required: true,
  },
  {
    key: "constructionEnvironment",
    group: "env",
    label: "施工环境",
    description: "开阔 / 邻近建筑 / 受限空间等。",
    required: true,
  },
  {
    key: "protectionTarget",
    group: "env",
    label: "周边保护对象",
    description: "用于推算默认允许振速。",
    required: true,
  },
  {
    key: "environmentSensitivity",
    group: "env",
    label: "环境敏感度",
    description: "影响安全评分权重。",
    required: true,
  },
  {
    key: "peakParticleVelocity",
    group: "env",
    label: "允许峰值振速 v（cm/s）",
    description: "高敏感场景必填；为空时默认推算。",
    unit: "cm/s",
    required: false,
    placeholder: "可留空，Demo 会自动推算",
    tip: "该字段缺失且敏感度高时会被 Safety Reviewer 阻断。",
  },
  {
    key: "flyrockRisk",
    group: "env",
    label: "飞石风险等级",
    description: "人工评估，影响飞石风险项与方案备注。",
    required: true,
  },
  {
    key: "costPreference",
    group: "cost",
    label: "成本倾向",
    description: "评分权重会随此字段微调。",
    required: true,
  },
  {
    key: "convenienceRequirement",
    group: "cost",
    label: "施工便利性要求",
    description: "影响评分权重。",
    required: true,
  },
  {
    key: "freeTextNotes",
    group: "cost",
    label: "补充说明（自然语言）",
    description: "可选；模拟大模型从自然语言中抽取约束。",
    required: false,
    placeholder: "例如：靠近居民区，需严格控制振动与飞石。",
  },
  {
    key: "benchHeight",
    group: "demo",
    label: "台阶高度",
    description: "Demo 模拟参数；不填时由归一化规则给出建议。",
    unit: "m",
    required: false,
    isDemo: true,
    placeholder: "例如：12",
  },
  {
    key: "holeDiameter",
    group: "demo",
    label: "孔径",
    description: "Demo 模拟参数。",
    unit: "mm",
    required: false,
    isDemo: true,
    placeholder: "例如：138",
  },
  {
    key: "holeDepth",
    group: "demo",
    label: "孔深",
    description: "Demo 模拟参数。",
    unit: "m",
    required: false,
    isDemo: true,
    placeholder: "例如：12.5",
  },
  {
    key: "stemmingLength",
    group: "demo",
    label: "堵塞长度",
    description: "Demo 模拟参数。",
    unit: "m",
    required: false,
    isDemo: true,
    placeholder: "例如：3.2",
  },
  {
    key: "targetFragmentation",
    group: "demo",
    label: "目标块度",
    description: "Demo 模拟参数。",
    unit: "cm",
    required: false,
    isDemo: true,
    placeholder: "例如：60",
  },
];

export function fieldsByGroup(): Record<FieldMeta["group"], FieldMeta[]> {
  const out: Record<FieldMeta["group"], FieldMeta[]> = {
    scenario: [],
    env: [],
    cost: [],
    demo: [],
  };
  for (const f of FORM_FIELDS) out[f.group].push(f);
  return out;
}

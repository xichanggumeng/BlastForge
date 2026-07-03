/**
 * 三套预设场景。
 *
 * 设计要点：
 * - 一站式：选择预设即填充完整表单；
 * - 显式高亮展示能力；
 * - 输入值必须经过 blastScenarioInputSchema 校验（脚本测试中再确认）。
 * - 完全确定性：相同预设 id 永远产生相同 input。
 */

import type { BlastScenarioInput, ScenarioPreset } from "./contracts";

export const STANDARD_PRESET_INPUT: BlastScenarioInput = {
  engineeringType: "open-pit-bench",
  rockCategory: "medium",
  protodyakonov: 8,
  jointCondition: "blocky",
  waterCondition: "damp",
  constructionEnvironment: "open-area",
  protectionTarget: "none",
  environmentSensitivity: "low",
  costPreference: "balanced",
  convenienceRequirement: "medium",
  freeTextNotes: "标准露天台阶爆破，参数齐全，预期主流程顺畅。",
  benchHeight: 12,
  holeDiameter: 138,
  holeDepth: 12.5,
  stemmingLength: 3.2,
  targetFragmentation: 60,
  peakParticleVelocity: 5,
  flyrockRisk: "low",
};

export const COMPLEX_PRESET_INPUT: BlastScenarioInput = {
  engineeringType: "tunnel",
  rockCategory: "medium-hard",
  protodyakonov: 10,
  jointCondition: "fractured",
  waterCondition: "wet",
  constructionEnvironment: "near-residential",
  protectionTarget: "residential",
  environmentSensitivity: "medium",
  costPreference: "balanced",
  convenienceRequirement: "medium",
  freeTextNotes:
    "隧洞掘进含水且邻近居民区，存在成本 / 安全 / 环境多约束，触发多方案对比。",
  benchHeight: 4,
  holeDiameter: 76,
  holeDepth: 4.2,
  stemmingLength: 1.5,
  targetFragmentation: 40,
  peakParticleVelocity: 2,
  flyrockRisk: "medium",
};

export const HIGH_RISK_PRESET_INPUT: BlastScenarioInput = {
  engineeringType: "urban-excavation",
  rockCategory: "medium",
  protodyakonov: 6,
  jointCondition: "highly-fractured",
  waterCondition: "saturated",
  constructionEnvironment: "near-sensitive",
  protectionTarget: "hospital",
  environmentSensitivity: "high",
  costPreference: "strict",
  convenienceRequirement: "low",
  freeTextNotes:
    "城际铁路基坑，紧邻医院与历史建筑，存在飞石 / 振速 / 含水多重风险，预计 Safety Reviewer 阻断。",
  benchHeight: 6,
  holeDiameter: 89,
  holeDepth: 6.5,
  stemmingLength: 1.6,
  /** 不填允许振速 → 用于演示 INPUT_V_MISSING danger 级别阻断 */
  targetFragmentation: 35,
  flyrockRisk: "high",
};

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: "standard",
    name: "常规规划场景",
    shortLabel: "常规",
    description:
      "参数完整、规则无冲突，预期主流程顺畅，用于展示标准闭环与报告输出。",
    highlight: [
      "全 Workflow 顺畅执行",
      "推荐方案可直接对比备选方案",
      "演示报告输出链路",
    ],
    input: STANDARD_PRESET_INPUT,
  },
  {
    id: "complex",
    name: "复杂约束场景",
    shortLabel: "复杂",
    description:
      "炮孔含水 + 周边居民区 + 成本敏感，存在多约束、多方案对比与折衷选择。",
    highlight: [
      "多方案雷达 + 柱状联动",
      "Agent 协同讨论痕迹",
      "人工重点复核清单",
    ],
    input: COMPLEX_PRESET_INPUT,
  },
  {
    id: "high-risk",
    name: "高风险拦截场景",
    shortLabel: "高风险",
    description:
      "缺少年允许峰值振速，飞石 / 装药结构 / 单响药量多重冲突，将被 Safety Reviewer 阻断。",
    highlight: [
      "高风险项统一 RiskBadge",
      "Workflow 被阻断并要求补充信息",
      "人工复核节点显式标记",
    ],
    input: HIGH_RISK_PRESET_INPUT,
  },
];

export function getScenarioPreset(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find((p) => p.id === id);
}

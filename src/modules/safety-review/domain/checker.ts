import "server-only";

/**
 * Safety Reviewer —— 确定性安全复核。
 *
 * 输入：
 *  - blastScenarioInput：原始输入；
 *  - normalized：标准化参数；
 *  - ruleIssues：规则预检结果；
 *  - schemeSet：方案集合；
 *  - citationCount：本次 Run 命中的引用数；
 *  - riskItems：风险条目；
 *  - reviewRequirements：人工复核项。
 *
 * 输出：
 *  - 完整的 checklist；
 *  - 是否阻断；
 *  - "人工重点确认清单"（仅包含 warning/block）。
 */

import type { NormalizedParameterSet, SchemeSet, RiskItem, ReviewRequirement, RuleCheckIssue } from "@/modules/parameter-planning/domain/contracts";
import type { BlastScenarioInput } from "@/modules/parameter-planning/domain/contracts";
import {
  SAFETY_RULE_CODES,
  type SafetyChecklistItem,
  type SafetyChecklistKind,
  type SafetyChecklistResult,
  type SafetyChecklistSeverity,
} from "./contracts";

interface RunSafetyReviewerInput {
  input: BlastScenarioInput;
  normalized: NormalizedParameterSet;
  ruleIssues: ReadonlyArray<RuleCheckIssue>;
  schemeSet: SchemeSet;
  citationCount: number;
  risks: ReadonlyArray<RiskItem>;
  reviews: ReadonlyArray<ReviewRequirement>;
}

/**
 * 必需字段集合：任何缺失都会触发 missing-param 检查。
 */
const REQUIRED_INPUT_FIELDS: Array<keyof BlastScenarioInput> = [
  "engineeringType",
  "rockCategory",
  "environmentSensitivity",
  "costPreference",
  "convenienceRequirement",
];

/**
 * 高风险字段：一旦被设置会直接触发 block。
 */
const HIGH_RISK_VALUES: ReadonlyArray<{
  field: keyof BlastScenarioInput;
  match: (value: unknown) => boolean;
  title: string;
  description: string;
}> = [
  {
    field: "environmentSensitivity",
    match: (v) => v === "high",
    title: "环境敏感等级 = 高",
    description:
      "环境敏感等级为「高」时，必须由具备资质的安全工程师复核最大单响 / 振动控制 / 防护距离，并在报告中签字。",
  },
  {
    field: "engineeringType",
    match: (v) => v === "urban-excavation" || v === "underground-cavern" || v === "tunnel",
    title: "城镇 / 地下 / 隧道爆破",
    description:
      "城镇 / 地下 / 隧道爆破必须落实爆破振动监测与试爆校核，并取得相应行政许可。",
  },
];

/**
 * 规则与模型不一致的判定：若模型综合评分与按规则派生的"安全等级"差距过大，记为 model-vs-rule。
 */
function checkRuleConflicts(ruleIssues: ReadonlyArray<RuleCheckIssue>): SafetyChecklistItem[] {
  const out: SafetyChecklistItem[] = [];
  const conflicts = ruleIssues.filter((i) => i.severity === "danger");
  for (const c of conflicts) {
    out.push({
      id: `chk-rule-${c.code}`,
      kind: "rule-conflict",
      severity: "block",
      title: `规则冲突：${c.code}`,
      description:
        c.advice ?? c.message ?? `规则 ${c.code} 触发阻断级冲突；Agent 不得自动通过该节点。`,
      references: c.paramKey ? [c.paramKey, c.code] : [c.code],
      ownerRole: "safety-officer",
      canBypass: false,
    });
  }
  return out;
}

function checkMissingParams(input: BlastScenarioInput): SafetyChecklistItem[] {
  const out: SafetyChecklistItem[] = [];
  for (const field of REQUIRED_INPUT_FIELDS) {
    const v = input[field];
    if (v === undefined || v === null || v === "") {
      out.push({
        id: `chk-missing-${field}`,
        kind: "missing-param",
        severity: "block",
        title: `缺失参数：${field}`,
        description:
          "原始输入中缺少该字段；必须由现场人员补全后才能进入规划阶段。模型自由补全无效。",
        references: [field],
        ownerRole: "engineer",
        canBypass: false,
      });
    }
  }
  return out;
}

function checkHighRiskFields(input: BlastScenarioInput): SafetyChecklistItem[] {
  const out: SafetyChecklistItem[] = [];
  for (const cfg of HIGH_RISK_VALUES) {
    if (cfg.match(input[cfg.field])) {
      out.push({
        id: `chk-highrisk-${cfg.field}`,
        kind: "high-risk-field",
        severity: "block",
        title: cfg.title,
        description: cfg.description,
        references: [cfg.field],
        ownerRole: "safety-officer",
        canBypass: false,
      });
    }
  }
  return out;
}

function checkMissingCitations(citationCount: number, schemeCount: number): SafetyChecklistItem[] {
  if (schemeCount === 0) return [];
  if (citationCount === 0) {
    return [
      {
        id: "chk-missing-citations",
        kind: "missing-citation",
        severity: "warning",
        title: "无任何知识引用",
        description:
          "本次 Run 未命中任何知识库片段；推荐方案的关键参数必须由人工对照现行规范复核。",
        references: ["search_knowledge"],
        ownerRole: "reviewer",
        canBypass: true,
      },
    ];
  }
  if (citationCount < 2 && schemeCount >= 2) {
    return [
      {
        id: "chk-low-citations",
        kind: "missing-citation",
        severity: "info",
        title: "引用数量偏少",
        description: `本次仅命中 ${citationCount} 条引用，建议在 Planner 内主动补充检索以增强可解释性。`,
        references: ["search_knowledge"],
        ownerRole: "reviewer",
        canBypass: true,
      },
    ];
  }
  return [];
}

function checkModelVsRule(schemeSet: SchemeSet, ruleIssues: ReadonlyArray<RuleCheckIssue>): SafetyChecklistItem[] {
  const out: SafetyChecklistItem[] = [];
  const recommended = schemeSet.schemes.find((s) => s.id === schemeSet.recommendedId);
  const warningRules = ruleIssues.filter((i) => i.severity === "warning");
  if (!recommended) {
    out.push({
      id: "chk-no-recommended",
      kind: "model-vs-rule",
      severity: "warning",
      title: "未生成推荐方案",
      description: "Agent Runtime 未生成推荐方案；请检查 Workflow 链路或人工接管。",
      references: ["schemeSet.recommendedId"],
      ownerRole: "planner",
      canBypass: true,
    });
  }
  if (recommended && warningRules.length > 0) {
    for (const r of warningRules) {
      out.push({
        id: `chk-model-rule-${r.code}`,
        kind: "model-vs-rule",
        severity: "warning",
        title: `推荐方案与规则提示不一致：${r.code}`,
        description:
          r.advice ??
          r.message ??
          "推荐方案与规则提示不一致；需要人工确认是否调整推荐或修改规则。",
        references: r.paramKey ? [recommended.id, r.paramKey, r.code] : [recommended.id, r.code],
        ownerRole: "planner",
        canBypass: true,
      });
    }
  }
  return out;
}

function checkEnvironmentSensitive(
  input: BlastScenarioInput,
  risks: ReadonlyArray<RiskItem>,
): SafetyChecklistItem[] {
  const out: SafetyChecklistItem[] = [];
  if (input.environmentSensitivity !== "high") return out;
  const highRisks = risks.filter((r) => r.level === "high");
  if (highRisks.length > 0) {
    for (const r of highRisks) {
      out.push({
        id: `chk-env-risk-${r.id}`,
        kind: "environment-sensitive",
        severity: "block",
        title: `环境敏感场景识别到高风险：${r.title}`,
        description:
          r.description ??
          "高敏感环境下识别到关键风险；必须由具备资质的安全工程师确认控制措施。",
        references: [r.id, r.schemeId ?? "", r.paramKey ?? ""].filter(Boolean),
        ownerRole: "safety-officer",
        canBypass: false,
      });
    }
  }
  return out;
}

function checkManualConfirmations(reviews: ReadonlyArray<ReviewRequirement>): SafetyChecklistItem[] {
  return reviews.map((r) => ({
    id: `chk-review-${r.id}`,
    kind: r.level === "high" ? "high-risk-field" : "model-vs-rule",
    severity: r.level === "high" ? "block" : "warning",
    title: r.reason,
    description: r.reason,
    references: [r.id, r.paramKey ?? "", r.schemeId ?? ""].filter(Boolean),
    ownerRole: r.level === "high" ? "safety-officer" : "reviewer",
    canBypass: r.level !== "high",
  }));
}

export function runSafetyReview(input: RunSafetyReviewerInput): SafetyChecklistResult {
  const items: SafetyChecklistItem[] = [
    ...checkMissingParams(input.input),
    ...checkRuleConflicts(input.ruleIssues),
    ...checkHighRiskFields(input.input),
    ...checkMissingCitations(input.citationCount, input.schemeSet.schemes.length),
    ...checkModelVsRule(input.schemeSet, input.ruleIssues),
    ...checkEnvironmentSensitive(input.input, input.risks),
    ...checkManualConfirmations(input.reviews),
  ];
  const blocked = items.some((i) => i.severity === "block");
  const manualConfirmation = items.filter((i) => i.severity !== "info");
  return {
    items,
    blocked,
    manualConfirmation,
  };
}

export function severityRank(severity: SafetyChecklistSeverity): number {
  return severity === "block" ? 3 : severity === "warning" ? 2 : 1;
}

export function kindLabel(kind: SafetyChecklistKind): string {
  return {
    "missing-param": "缺失参数",
    "rule-conflict": "规则冲突",
    "model-vs-rule": "模型与规则",
    "missing-citation": "缺少引用",
    "high-risk-field": "高风险字段",
    "environment-sensitive": "环境敏感",
    "data-freshness": "数据时效",
  }[kind];
}

export { SAFETY_RULE_CODES };
/**
 * Safety Reviewer Module —— 安全复核模块。
 *
 * 职责：
 * 1. 基于规则 / 确定性检查生成"人工重点确认清单"（reviewChecklist）；
 * 2. 当存在高风险字段或规则冲突时阻断 Workflow 推进；
 * 3. 不依赖模型自由判断，所有检查项均通过 Zod + 纯函数 + 配置文件驱动。
 *
 * 设计原则：
 * - 与 Agent Runtime 解耦：可被 RunSafetyReviewerTool / Planner 共同调用；
 * - 每条 checklistItem 必须有明确的判定依据（rule / model / missingCitation）；
 * - 阻断与否由 severity 与 canBypass 共同决定；高风险永远阻断。
 */

export type SafetyChecklistSeverity = "info" | "warning" | "block";

export type SafetyChecklistKind =
  | "missing-param"
  | "rule-conflict"
  | "model-vs-rule"
  | "missing-citation"
  | "high-risk-field"
  | "environment-sensitive"
  | "data-freshness";

export interface SafetyChecklistItem {
  id: string;
  kind: SafetyChecklistKind;
  severity: SafetyChecklistSeverity;
  title: string;
  /** 完整描述，列出触发条件与人工复核要点 */
  description: string;
  /** 关联参数 key / 方案 id / 规则 code */
  references: string[];
  /** 责任人员或角色（演示中固定为 Demo Reviewer） */
  ownerRole: "reviewer" | "planner" | "engineer" | "safety-officer";
  /** 该条目是否可被人工覆写（高风险字段永远为 false） */
  canBypass: boolean;
}

export interface SafetyChecklistResult {
  items: SafetyChecklistItem[];
  /** 是否存在阻断级条目 */
  blocked: boolean;
  /** 由 reviewChecklist 派生的"人工重点确认清单" */
  manualConfirmation: SafetyChecklistItem[];
}

export const SAFETY_RULE_CODES = {
  missingKeyParam: "MISSING_KEY_PARAM",
  missingCitation: "MISSING_CITATION",
  ruleConflict: "RULE_CONFLICT",
  modelVsRule: "MODEL_VS_RULE_MISMATCH",
  highRiskField: "HIGH_RISK_FIELD",
  environmentSensitive: "ENVIRONMENT_SENSITIVE",
  staleData: "STALE_DATA",
} as const;
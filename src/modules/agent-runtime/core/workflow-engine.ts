/**
 * Workflow Engine —— 主工作流定义与状态机。
 *
 * 设计：
 * - 主 Workflow 顺序：validate_input → normalize_parameters → retrieve_knowledge →
 *   run_rule_precheck → plan_parameters → generate_schemes → calculate_scores →
 *   review_safety → human_approval → generate_report → report_ready；
 * - 每个 Step 有明确输入、输出与状态；
 * - Step 可关联 Agent；
 * - 状态变更通过 EventEmitter 通知 Orchestrator；
 * - 从持久化快照重建视图。
 */

import type { StepKind, StepStatus, WorkflowStep, WorkflowStepState } from "./contracts";

export interface WorkflowStepSpec extends WorkflowStep {
  /** Step 在编排中的位置（决定顺序） */
  order: number;
  /** 关联 Tool（用于 Orchestrator 自动调用） */
  toolName?: string;
  /** 是否需要 human approval 才能进入下一步 */
  gateOnApproval?: boolean;
}

/** 主 Workflow —— 与设计规范 §15.1 / 现有 PlanningStepId 对齐。 */
export const MAIN_WORKFLOW_STEPS: ReadonlyArray<WorkflowStepSpec> = [
  {
    order: 1,
    id: "wf-step-validate_input",
    stepId: "validate_input",
    label: "validate_input",
    description: "Zod 校验输入并初始化 Run。",
    kind: "input_validation",
    agentId: "supervisor",
    requiresApproval: false,
  },
  {
    order: 2,
    id: "wf-step-normalize_parameters",
    stepId: "normalize_parameters",
    label: "normalize_parameters",
    description: "归一化输入为标准参数。",
    kind: "normalization",
    agentId: "normalizer",
    requiresApproval: false,
    toolName: "normalize_engineering_parameters",
  },
  {
    order: 3,
    id: "wf-step-retrieve_knowledge",
    stepId: "retrieve_knowledge",
    label: "retrieve_knowledge",
    description: "检索相关知识片段与引用。",
    kind: "retrieval",
    agentId: "retriever",
    requiresApproval: false,
    toolName: "search_knowledge",
  },
  {
    order: 4,
    id: "wf-step-run_rule_precheck",
    stepId: "run_rule_precheck",
    label: "run_rule_precheck",
    description: "执行确定性工程规则。",
    kind: "rule_check",
    agentId: "safety",
    requiresApproval: false,
    toolName: "run_rule_check",
  },
  {
    order: 5,
    id: "wf-step-plan_parameters",
    stepId: "plan_parameters",
    label: "plan_parameters",
    description: "参数预测与规划。",
    kind: "planning",
    agentId: "planner",
    requiresApproval: false,
    toolName: "analyze_parameter_sensitivity",
  },
  {
    order: 6,
    id: "wf-step-generate_schemes",
    stepId: "generate_schemes",
    label: "generate_schemes",
    description: "生成推荐 / 备选 / 风险方案。",
    kind: "scheme_generation",
    agentId: "generator",
    requiresApproval: false,
    toolName: "compare_schemes",
  },
  {
    order: 7,
    id: "wf-step-calculate_scores",
    stepId: "calculate_scores",
    label: "calculate_scores",
    description: "调用评分工具计算多指标。",
    kind: "scoring",
    agentId: "evaluator",
    requiresApproval: false,
    toolName: "calculate_scheme_score",
  },
  {
    order: 8,
    id: "wf-step-review_safety",
    stepId: "review_safety",
    label: "review_safety",
    description: "Safety Reviewer 复核，必要时阻断。",
    kind: "review",
    agentId: "safety",
    requiresApproval: false,
  },
  {
    order: 9,
    id: "wf-step-human_approval",
    stepId: "human_approval",
    label: "human_approval",
    description: "等待人工确认。",
    kind: "approval",
    agentId: "supervisor",
    requiresApproval: true,
    gateOnApproval: true,
  },
  {
    order: 10,
    id: "wf-step-generate_report",
    stepId: "generate_report",
    label: "generate_report",
    description: "生成结构化报告大纲。",
    kind: "report",
    agentId: "report",
    requiresApproval: false,
    toolName: "build_report_outline",
  },
];

/** 创建初始的 Step 状态列表（全部 pending）。 */
export function buildInitialStepStates(): WorkflowStepState[] {
  return MAIN_WORKFLOW_STEPS.map((s) => ({
    id: s.id,
    stepId: s.stepId,
    label: s.label,
    description: s.description,
    kind: s.kind,
    agentId: s.agentId,
    requiresApproval: s.requiresApproval,
    status: "pending",
  }));
}

/** 根据已知 completedSteps 重建状态列表（用于恢复 / Replay 视图）。 */
export function rebuildStepStates(
  overrides: Partial<Record<string, Partial<WorkflowStepState>>>,
): WorkflowStepState[] {
  return buildInitialStepStates().map((state) => {
    const override = overrides[state.id];
    return override ? { ...state, ...override } : state;
  });
}

export function findStepSpec(stepId: string): WorkflowStepSpec | undefined {
  return MAIN_WORKFLOW_STEPS.find((s) => s.stepId === stepId);
}

/** 判断 Step 是否属于"高风险阻断点"。 */
export function isBlockingStep(stepId: string): boolean {
  return stepId === "review_safety" || stepId === "human_approval";
}

export type { StepKind, StepStatus, WorkflowStep, WorkflowStepState };
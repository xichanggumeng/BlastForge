/**
 * BlastForge Agent Runtime —— 核心类型契约。
 *
 * 这些契约同时被服务端 Runtime 与浏览器端 UI 消费。
 * - 所有事件、状态、Agent 定义都通过 Zod 校验；
 * - Agent 不得依赖 React / DOM / 浏览器 API；
 * - 任何对 DeepSeek / OpenAI SDK 的引用都封装在 Provider Adapter 内。
 */

export type AgentMode = "thinking" | "non-thinking";

/* ---------- Agent 定义 ---------- */

export interface AgentDefinitionMeta {
  id: string;
  name: string;
  description: string;
  /** 模型 ID；由环境变量 + Provider Adapter 解析 */
  model: string;
  mode: AgentMode;
  /** Tool 名列表（仅允许在 ToolRegistry 中存在） */
  tools: readonly string[];
  /** 单次 Agent 运行最大步骤数（含 Tool 调用），用于防御无限循环 */
  maxSteps: number;
  /** 单次 Agent 运行超时（毫秒） */
  timeoutMs: number;
  /** 系统 Prompt 版本号（与 prompt-registry 中的版本对应） */
  promptVersion: string;
  /** 是否需要人工审批才能继续；为 true 时工作流进入 waiting_for_approval */
  requiresApproval: boolean;
}

/** ZodType 抽象：避免循环依赖；运行期校验通过各 Agent 的 inputSchema / outputSchema 自行处理 */
export interface ZodLike<TInput> {
  parse(input: unknown): TInput;
  safeParse(input: unknown): { success: true; data: TInput } | { success: false; error: unknown };
}

export interface AgentDefinition<TInput = unknown, TOutput = unknown>
  extends AgentDefinitionMeta {
  inputSchema: ZodLike<TInput>;
  outputSchema: ZodLike<TOutput>;
}

/* ---------- Workflow 状态 ---------- */

export const WORKFLOW_STATUSES = [
  "created",
  "queued",
  "running",
  "waiting_for_input",
  "waiting_for_approval",
  "completed",
  "blocked",
  "failed",
  "cancelled",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const STEP_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "warning",
  "failed",
  "blocked",
  "skipped",
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** Step 在工作流编排中的语义角色（用于可视化与过滤） */
export const STEP_KINDS = [
  "input_validation",
  "normalization",
  "retrieval",
  "rule_check",
  "planning",
  "scheme_generation",
  "scoring",
  "review",
  "approval",
  "report",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export interface WorkflowStep {
  id: string;
  /** 与 PlanningStepId 对齐（validate_input / normalize_parameters / ...） */
  stepId: string;
  label: string;
  description: string;
  /** 语义角色 */
  kind: StepKind;
  /** 关联 Agent id */
  agentId: string;
  /** 是否需要人工审批 */
  requiresApproval: boolean;
}

export interface WorkflowStepState extends WorkflowStep {
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  /** 安全的结构化输出摘要（不含系统 Prompt / API Key / 隐藏思维） */
  outputSummary?: string;
  /** 关联的引用 id 列表 */
  citationIds?: readonly string[];
  /** 关联的 Tool 调用 id 列表 */
  toolCallIds?: readonly string[];
  /** 错误码或错误信息（前端展示用，已脱敏） */
  errorCode?: string;
  errorMessage?: string;
}

/* ---------- Workflow Run ---------- */

export interface WorkflowRun {
  id: string;
  /** 关联工作流定义 id（保留以支持多工作流；当前固定为 main） */
  workflowId: string;
  /** 关联项目 / 场景 / 预设 id */
  scenarioId?: string;
  presetId?: string;
  /** 原始输入指纹，便于检索/恢复 */
  fingerprint: string;
  status: WorkflowStatus;
  steps: readonly WorkflowStepState[];
  /** 全局结构化输出（如 PlanningRun.schemeSet 的部分摘要），由前端展示 */
  outputSummary?: WorkflowOutputSummary;
  /** 是否处于 Demo Replay 模式 */
  replay: boolean;
  /** 阻塞或失败原因（前端安全摘要） */
  blockedReason?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/** 前端可见的 Workflow 结构化输出摘要；不含隐藏 Prompt、API Key */
export interface WorkflowOutputSummary {
  schemeCount: number;
  recommendedSchemeId?: string;
  riskCount: number;
  reviewCount: number;
  /** 推荐方案的多维评分（仅数字） */
  recommendedScores?: {
    safety: number;
    suitability: number;
    economy: number;
    convenience: number;
    environment: number;
    overall: number;
  };
  notes?: string;
}

/* ---------- 引用 / Citations ---------- */

export interface Citation {
  id: string;
  documentId: string;
  documentTitle: string;
  /** 来源类型：knowledge / regulation / case / material */
  sourceType?: string;
  category: string;
  page?: number;
  section?: string;
  excerpt: string;
  score: number;
  /** 命中的检索 token（关键词 / 元数据提示词） */
  matchedTokens?: ReadonlyArray<string>;
  /** 影响的下游结论（参数名 / 方案 id / 风险码） */
  affectedConclusions?: ReadonlyArray<string>;
  /** 引用该文档的 Agent id 列表 */
  usedByAgents?: ReadonlyArray<string>;
}

/* ---------- Tool Call ---------- */

export interface ToolCallRecord {
  id: string;
  /** Tool 名（与 ToolRegistry 对应） */
  name: string;
  /** 关联 Agent id */
  agentId: string;
  /** 关联 Step id */
  stepId: string;
  /** 关联 Workflow run id */
  runId: string;
  /** 输入（经 Zod 校验后） */
  input: unknown;
  /** 输出（经 Zod 校验后） */
  output: unknown;
  status: "running" | "succeeded" | "failed";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  errorMessage?: string;
}

/* ---------- Trace ---------- */

export type TraceStatus = "running" | "succeeded" | "failed";

export interface TraceRecord {
  id: string;
  requestId: string;
  runId: string;
  workflowId: string;
  stepId: string;
  agentId?: string;
  toolCallId?: string;
  projectId?: string;
  scenarioId?: string;
  model: string;
  mode: AgentMode;
  promptVersion: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: TraceStatus;
  errorCode?: string;
}

/** 前端可见的安全摘要：不暴露 system prompt / API Key / 隐藏思维 */
export interface FrontendTraceSummary {
  id: string;
  runId: string;
  stepId: string;
  agentId?: string;
  toolCallId?: string;
  model: string;
  mode: AgentMode;
  promptVersion: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: TraceStatus | "blocked" | "skipped";
  errorCode?: string;
}

/* ---------- Workflow 事件 ---------- */

export const WORKFLOW_EVENT_TYPES = [
  "workflow.started",
  "step.started",
  "agent.started",
  "tool.called",
  "tool.completed",
  "citation.attached",
  "step.completed",
  "review.blocked",
  "human.input_requested",
  "human.approved",
  "workflow.completed",
  "workflow.failed",
  "workflow.cancelled",
] as const;
export type WorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];

export interface BaseWorkflowEvent {
  eventId: string;
  sequence: number;
  runId: string;
  workflowId: string;
  stepId?: string;
  agentId?: string;
  toolCallId?: string;
  timestamp: number;
  /** 安全 payload 抽象；具体类型见 union 分支 */
  payload: Record<string, unknown>;
}

export type WorkflowEvent =
  | (BaseWorkflowEvent & { type: "workflow.started"; payload: { workflowId: string; fingerprint: string; replay: boolean; model: string } })
  | (BaseWorkflowEvent & { type: "step.started"; payload: { stepId: string; stepLabel: string; agentId: string } })
  | (BaseWorkflowEvent & { type: "agent.started"; payload: { agentId: string; agentName: string; mode: AgentMode; promptVersion: string } })
  | (BaseWorkflowEvent & { type: "tool.called"; payload: { toolCallId: string; toolName: string; agentId: string } })
  | (BaseWorkflowEvent & { type: "tool.completed"; payload: { toolCallId: string; toolName: string; durationMs: number; success: boolean } })
  | (BaseWorkflowEvent & { type: "citation.attached"; payload: { citationId: string; documentTitle: string; category: string; score: number } })
  | (BaseWorkflowEvent & { type: "step.completed"; payload: { stepId: string; status: StepStatus; durationMs: number; outputSummary?: string } })
  | (BaseWorkflowEvent & { type: "review.blocked"; payload: { stepId: string; reason: string; ruleCodes: readonly string[] } })
  | (BaseWorkflowEvent & { type: "human.input_requested"; payload: { stepId: string; prompt: string } })
  | (BaseWorkflowEvent & { type: "human.approved"; payload: { stepId: string; approver: string; comment?: string } })
  | (BaseWorkflowEvent & { type: "workflow.completed"; payload: { status: "completed"; durationMs: number; replay: boolean } })
  | (BaseWorkflowEvent & { type: "workflow.failed"; payload: { status: "failed"; errorCode: string; errorMessage: string; durationMs: number } })
  | (BaseWorkflowEvent & { type: "workflow.cancelled"; payload: { status: "cancelled"; reason: string } });

/* ---------- Provider Adapter 抽象 ---------- */

export interface GenerateObjectInput<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodLike<T>;
  model: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface StreamTextInput {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface StreamTextHandle {
  /** 累积完整文本 */
  text(): Promise<string>;
  /** 取消 */
  abort(): void;
}

export interface LanguageModelProvider {
  readonly name: string;
  /** 是否可用（API Key 等基础条件） */
  readonly isAvailable: boolean;
  generateObject<T>(input: GenerateObjectInput<T>): Promise<T>;
  streamText(input: StreamTextInput): StreamTextHandle;
}
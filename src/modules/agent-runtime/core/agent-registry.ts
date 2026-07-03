/**
 * Agent Registry —— 8 个专业 Agent 的定义与执行接口。
 *
 * 每个 Agent：
 * - 拥有明确职责；
 * - 声明 id / name / model / mode / tools / maxSteps / timeoutMs / promptVersion / requiresApproval；
 * - 拥有 inputSchema / outputSchema（Zod）；
 * - 提供 run(ctx) 入口，返回结构化输出；
 * - 不得依赖 React。
 *
 * 实际模型调用由 AgentRuntime 委托给 Provider Adapter；
 * 这里只负责把 prompt + input 包装成 Provider 调用 + 解析输出。
 */

import "server-only";

import { z } from "zod";

import type { AgentDefinition, ZodLike } from "./contracts";
import { getPrompt } from "./prompt-registry";
import { asZodLike, getLanguageModelProvider, ProviderError } from "../server/provider";

/* ---------- Agent 运行上下文 ---------- */

export interface AgentRunContext {
  runId: string;
  stepId: string;
  agentId: string;
  abortSignal?: AbortSignal;
  /** 注入到 prompt 的额外 JSON 上下文 */
  context?: Record<string, unknown>;
}

export interface AgentRunResult<TOutput> {
  output: TOutput;
  /** 实际使用的 prompt version（用于 trace） */
  promptVersion: string;
  /** 模型名 */
  model: string;
  /** 模型调用是否成功（false 表示降级 / 失败） */
  fromModel: boolean;
  /** 错误码（如果失败） */
  errorCode?: string;
}

/* ---------- 通用 Agent 实现辅助 ---------- */

async function callProviderForAgent<TInput, TOutput>(
  def: AgentDefinition<TInput, TOutput>,
  input: TInput,
  ctx: AgentRunContext,
  /** 构造 user prompt 的回调（不同 Agent 拼装不同） */
  buildUserPrompt: (input: TInput) => string,
): Promise<AgentRunResult<TOutput>> {
  const prompt = getPrompt(def.id, def.promptVersion);
  const provider = getLanguageModelProvider();
  if (!provider.isAvailable) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", "Provider 不可用，应回退到 Demo Replay");
  }
  const userPrompt = buildUserPrompt(input);
  const finalPrompt = ctx.context
    ? `${userPrompt}\n\n[Context]\n${JSON.stringify(ctx.context)}`
    : userPrompt;
  const data = await provider.generateObject<TOutput>({
    systemPrompt: prompt.system,
    userPrompt: finalPrompt,
    schema: asZodLike(def.outputSchema as unknown as z.ZodType<TOutput>),
    model: def.model,
    timeoutMs: def.timeoutMs,
    ...(ctx.abortSignal ? { signal: ctx.abortSignal } : {}),
  });
  return {
    output: data,
    promptVersion: def.promptVersion,
    model: def.model,
    fromModel: true,
  };
}

/* ---------- Zod Schemas ---------- */

const supervisorInputSchema = z.object({
  fingerprint: z.string(),
  presetId: z.string().optional(),
  freeTextNotes: z.string().default(""),
});

const supervisorOutputSchema = z.object({
  workflowId: z.string(),
  notes: z.string().default(""),
});

const normalizerInputSchema = z.object({
  fingerprint: z.string(),
  rawInput: z.record(z.string(), z.unknown()),
  freeTextNotes: z.string().default(""),
});

const normalizerOutputSchema = z.object({
  partialOverrides: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().default(""),
});

const retrieverInputSchema = z.object({
  fingerprint: z.string(),
  query: z.string(),
});

const retrieverOutputSchema = z.object({
  citations: z.array(
    z.object({
      id: z.string(),
      documentTitle: z.string(),
      category: z.string(),
      score: z.number(),
    }),
  ),
  notes: z.string().default(""),
});

const plannerInputSchema = z.object({
  fingerprint: z.string(),
  partialOverrides: z.record(z.string(), z.unknown()).default({}),
  citations: z
    .array(
      z.object({
        id: z.string(),
        documentTitle: z.string(),
        category: z.string(),
      }),
    )
    .default([]),
});

const plannerOutputSchema = z.object({
  /** 模型可解释的提示，仅作为输出补充 */
  rationale: z.string().default(""),
  /** 模型标记需重点关注的高敏感参数 key */
  highSensitiveKeys: z.array(z.string()).default([]),
});

const generatorInputSchema = z.object({
  fingerprint: z.string(),
  normalized: z.record(z.string(), z.unknown()),
  rules: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.enum(["info", "warning", "danger"]),
    }),
  ),
});

const generatorOutputSchema = z.object({
  /** 模型生成的方案叙述补充 */
  narratives: z.array(
    z.object({
      schemeId: z.string(),
      applicability: z.string(),
    }),
  ),
  notes: z.string().default(""),
});

const evaluatorInputSchema = z.object({
  fingerprint: z.string(),
  schemeIds: z.array(z.string()),
});

const evaluatorOutputSchema = z.object({
  explanations: z.array(
    z.object({
      schemeId: z.string(),
      rationale: z.string(),
    }),
  ),
});

const safetyInputSchema = z.object({
  fingerprint: z.string(),
  ruleIssues: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.enum(["info", "warning", "danger"]),
    }),
  ),
  schemeIds: z.array(z.string()),
  reviewItems: z.array(
    z.object({
      paramKey: z.string().optional(),
      schemeId: z.string().optional(),
      reason: z.string(),
      level: z.enum(["low", "medium", "high"]),
    }),
  ),
});

const safetyOutputSchema = z.object({
  decision: z.enum(["passed", "blocked"]),
  reason: z.string(),
  ruleCodes: z.array(z.string()).default([]),
  reviewItems: z.array(
    z.object({
      paramKey: z.string().optional(),
      schemeId: z.string().optional(),
      reason: z.string(),
      level: z.enum(["low", "medium", "high"]),
    }),
  ),
});

const reportInputSchema = z.object({
  fingerprint: z.string(),
  recommendedSchemeId: z.string(),
});

const reportOutputSchema = z.object({
  notes: z.string().default(""),
});

/* ---------- Agent 定义 ---------- */

export const AGENT_REGISTRY: ReadonlyArray<AgentDefinition<unknown, unknown>> = [
  {
    id: "supervisor",
    name: "Supervisor Agent",
    description: "理解用户目标、选择工作流并分配 Agent。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "thinking",
    inputSchema: asZodLike(supervisorInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(supervisorOutputSchema) as unknown as ZodLike<unknown>,
    tools: [],
    maxSteps: 4,
    timeoutMs: 12_000,
    promptVersion: "v1.0.0",
    requiresApproval: false,
  },
  {
    id: "normalizer",
    name: "Input Normalizer",
    description: "解析自然语言输入，提取标准工程字段。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "non-thinking",
    inputSchema: asZodLike(normalizerInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(normalizerOutputSchema) as unknown as ZodLike<unknown>,
    tools: ["normalize_engineering_parameters"],
    maxSteps: 3,
    timeoutMs: 10_000,
    promptVersion: "v1.0.0",
    requiresApproval: false,
  },
  {
    id: "retriever",
    name: "Knowledge Retriever",
    description: "检索知识库片段并返回引用。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "non-thinking",
    inputSchema: asZodLike(retrieverInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(retrieverOutputSchema) as unknown as ZodLike<unknown>,
    tools: ["search_knowledge"],
    maxSteps: 3,
    timeoutMs: 10_000,
    promptVersion: "v1.0.0",
    requiresApproval: false,
  },
  {
    id: "planner",
    name: "Parameter Planner",
    description: "依据标准化输入与知识进行参数预测与规划。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "thinking",
    inputSchema: asZodLike(plannerInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(plannerOutputSchema) as unknown as ZodLike<unknown>,
    tools: ["analyze_parameter_sensitivity"],
    maxSteps: 4,
    timeoutMs: 12_000,
    promptVersion: "v1.0.0",
    requiresApproval: false,
  },
  {
    id: "generator",
    name: "Scheme Generator",
    description: "生成推荐 / 备选 / 风险方案。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "thinking",
    inputSchema: asZodLike(generatorInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(generatorOutputSchema) as unknown as ZodLike<unknown>,
    tools: ["compare_schemes"],
    maxSteps: 4,
    timeoutMs: 12_000,
    promptVersion: "v1.0.0",
    requiresApproval: false,
  },
  {
    id: "evaluator",
    name: "Evaluation Agent",
    description: "调用确定性评分工具并解释评分。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "non-thinking",
    inputSchema: asZodLike(evaluatorInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(evaluatorOutputSchema) as unknown as ZodLike<unknown>,
    tools: ["calculate_scheme_score"],
    maxSteps: 3,
    timeoutMs: 10_000,
    promptVersion: "v1.0.0",
    requiresApproval: false,
  },
  {
    id: "safety",
    name: "Safety Reviewer",
    description: "复核高风险参数；必要时阻断运行。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "thinking",
    inputSchema: asZodLike(safetyInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(safetyOutputSchema) as unknown as ZodLike<unknown>,
    tools: ["run_rule_check", "request_human_approval"],
    maxSteps: 3,
    timeoutMs: 10_000,
    promptVersion: "v1.0.0",
    requiresApproval: false,
  },
  {
    id: "report",
    name: "Report Agent",
    description: "汇总最终方案并生成报告大纲。",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro",
    mode: "thinking",
    inputSchema: asZodLike(reportInputSchema) as unknown as ZodLike<unknown>,
    outputSchema: asZodLike(reportOutputSchema) as unknown as ZodLike<unknown>,
    tools: ["build_report_outline"],
    maxSteps: 2,
    timeoutMs: 8_000,
    promptVersion: "v1.0.0",
    requiresApproval: true,
  },
];

const BY_ID = new Map<string, AgentDefinition<unknown, unknown>>();
for (const a of AGENT_REGISTRY) BY_ID.set(a.id, a);

export function getAgent(id: string): AgentDefinition<unknown, unknown> {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Agent 不存在：${id}`);
  return def;
}

export function listAgents(): readonly AgentDefinition<unknown, unknown>[] {
  return AGENT_REGISTRY;
}

/* ---------- 运行入口（包装后调用 Provider Adapter） ---------- */

export async function runAgent<TInput, TOutput>(
  agentId: string,
  input: TInput,
  ctx: AgentRunContext,
): Promise<AgentRunResult<TOutput>> {
  const def = getAgent(agentId);
  return callProviderForAgent(
    def,
    input,
    ctx,
    (typed) => JSON.stringify(typed),
  ) as Promise<AgentRunResult<TOutput>>;
}
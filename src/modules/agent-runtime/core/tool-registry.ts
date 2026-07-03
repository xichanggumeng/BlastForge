/**
 * Tool Registry —— Agent 可调用的工具集合。
 *
 * 设计原则（来自设计规范 §16 / 会话 4 任务书）：
 * - 输入输出全部经过 Zod；
 * - Tool 有唯一名称；
 * - Tool 记录执行状态与耗时（由 ToolContext 注入时钟）；
 * - 确定性计算（规则、评分、敏感性、对比）继续复用会话 3 的纯函数；
 * - 不允许任意 SQL / Shell / 设备控制。
 */

import "server-only";

import { z } from "zod";

import {
  calculateSchemeScore,
  runRulePrecheck,
  normalizeParameters,
  planParameters,
  analyzeSensitivity,
  sortSchemesByOverall,
  generateSchemes,
  fingerprintInput,
  type ScoreWeights,
} from "@/modules/parameter-planning/domain/planner";
import {
  blastScenarioInputSchema,
  type BlastScenarioInput,
  type NormalizedParameterSet,
  type RiskItem,
  type RuleCheckIssue,
  type Scheme,
  type SchemeSet,
  type SensitivityMatrix,
} from "@/modules/parameter-planning/domain/contracts";

import type { Citation } from "./contracts";
import { getKnowledgeRepository } from "@/modules/knowledge/infrastructure/repository";
import {
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
} from "@/modules/knowledge/domain";
import { runSafetyReview, kindLabel, severityRank } from "@/modules/safety-review/domain";
import { getHumanApprovalService } from "@/modules/human-review/domain";

/* ---------- ToolContext ---------- */

export interface ToolContext {
  /** 当前 runId */
  runId: string;
  /** 当前 stepId */
  stepId: string;
  /** 当前 agentId */
  agentId: string;
  /** 当前时间（毫秒） */
  now: () => number;
  /** 注入 logger（可选） */
  log?: (level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => void;
}

/* ---------- AgentTool 接口 ---------- */

export interface AgentTool<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  /** 是否高风险（true → 必须人工审批） */
  readonly highRisk: boolean;
  execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
}

/* ---------- Inputs / Outputs ---------- */

const normalizeParamsInputSchema = z.object({
  input: blastScenarioInputSchema,
  /** 可选：模型已经推断过的字段（如 normalizer Agent 填入） */
  partialOverrides: z.record(z.string(), z.unknown()).optional(),
});

const normalizeParamsOutputSchema = z.object({
  normalized: z.object({
    engineeringTypeLabel: z.string(),
    rockCategoryLabel: z.string(),
    protodyakonov: z.number(),
    benchHeight: z.number(),
    holeDiameter: z.number(),
    holeDepth: z.number(),
    stemmingLength: z.number(),
    holeSpacing: z.number(),
    rowSpacing: z.number(),
    burdenDistance: z.number(),
    chargeStructure: z.enum(["coupled", "decked", "decoupled"]),
    linearChargeDensity: z.number(),
    maxChargePerDelay: z.number(),
    totalChargeKg: z.number(),
    peakParticleVelocity: z.number(),
  }),
  notes: z.string().default(""),
});

const searchKnowledgeInputSchema = z.object({
  query: z.string().min(1),
  /** 限制类别 */
  categories: z.array(z.string()).optional(),
  /** 最大返回条目 */
  limit: z.number().int().min(1).max(10).default(4),
});

const searchKnowledgeOutputSchema = z.object({
  citations: z.array(
    z.object({
      id: z.string(),
      documentId: z.string(),
      documentTitle: z.string(),
      sourceType: z.string(),
      category: z.string(),
      page: z.number().optional(),
      section: z.string().optional(),
      excerpt: z.string(),
      score: z.number().min(0).max(1),
      matchedTokens: z.array(z.string()),
      usedByAgents: z.array(z.string()),
      affectedConclusions: z.array(z.string()),
    }),
  ),
});

const runRuleCheckInputSchema = z.object({
  input: blastScenarioInputSchema.optional(),
  normalized: normalizeParamsOutputSchema.shape.normalized,
});

const runRuleCheckOutputSchema = z.object({
  issues: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.enum(["info", "warning", "danger"]),
      paramKey: z.string().optional(),
      advice: z.string().optional(),
    }),
  ),
  hasBlocking: z.boolean(),
});

const runSafetyReviewInputSchema = z.object({
  input: blastScenarioInputSchema,
  normalized: normalizeParamsOutputSchema.shape.normalized,
  ruleIssues: runRuleCheckOutputSchema.shape.issues,
  schemeSet: z.object({
    schemes: z.array(z.unknown()),
    recommendedId: z.string(),
    alternativeIds: z.array(z.string()),
    riskIds: z.array(z.string()),
  }),
  citationCount: z.number().int().min(0).default(0),
  risks: z.array(
    z.object({
      id: z.string(),
      level: z.enum(["low", "medium", "high"]),
      title: z.string(),
      description: z.string().default(""),
      schemeId: z.string().optional(),
      paramKey: z.string().optional(),
    }),
  ),
  reviews: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
      level: z.enum(["low", "medium", "high"]),
      paramKey: z.string().optional(),
      schemeId: z.string().optional(),
    }),
  ),
});

const runSafetyReviewOutputSchema = z.object({
  blocked: z.boolean(),
  items: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      severity: z.enum(["info", "warning", "block"]),
      title: z.string(),
      description: z.string(),
      references: z.array(z.string()),
      ownerRole: z.string(),
      canBypass: z.boolean(),
    }),
  ),
  manualConfirmation: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      severity: z.enum(["info", "warning", "block"]),
      references: z.array(z.string()),
    }),
  ),
});

const calculateScoreInputSchema = z.object({
  input: blastScenarioInputSchema.optional(),
  normalized: normalizeParamsOutputSchema.shape.normalized,
  category: z.enum(["recommended", "alternative", "risk"]),
  /** 可选：模型覆盖的权重 */
  weightOverrides: z
    .object({
      safety: z.number().min(0).max(1).optional(),
      suitability: z.number().min(0).max(1).optional(),
      economy: z.number().min(0).max(1).optional(),
      convenience: z.number().min(0).max(1).optional(),
      environment: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const calculateScoreOutputSchema = z.object({
  score: z.object({
    safety: z.number().min(0).max(100),
    suitability: z.number().min(0).max(100),
    economy: z.number().min(0).max(100),
    convenience: z.number().min(0).max(100),
    environment: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
  }),
});

const analyzeSensitivityInputSchema = z.object({
  input: blastScenarioInputSchema,
  normalized: normalizeParamsOutputSchema.shape.normalized,
  referenceScore: calculateScoreOutputSchema.shape.score,
});

const analyzeSensitivityOutputSchema = z.object({
  axes: z.array(z.string()),
  cells: z.array(
    z.object({
      parameterKey: z.string(),
      delta: z.number(),
      outputDelta: z.number(),
    }),
  ),
});

const compareSchemesInputSchema = z.object({
  schemes: z.array(z.unknown()).min(1),
});

const compareSchemesOutputSchema = z.object({
  ordered: z.array(z.string()),
  differences: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      unit: z.string(),
      values: z.record(z.string(), z.number()),
    }),
  ),
});

const requestHumanApprovalInputSchema = z.object({
  prompt: z.string().min(1),
  reasons: z.array(z.string()).default([]),
});

const requestHumanApprovalOutputSchema = z.object({
  approved: z.boolean(),
  approver: z.string(),
  comment: z.string().optional(),
  approvedAt: z.number(),
});

const buildReportOutlineInputSchema = z.object({
  scenarioName: z.string().min(1),
  recommendedSchemeId: z.string().min(1),
  reviewCount: z.number().int().nonnegative(),
  riskCount: z.number().int().nonnegative(),
});

const buildReportOutlineOutputSchema = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      summary: z.string(),
    }),
  ),
});

/* ---------- Tool 实现 ---------- */

class NormalizeEngineeringParametersTool
  implements AgentTool<z.infer<typeof normalizeParamsInputSchema>, z.infer<typeof normalizeParamsOutputSchema>>
{
  readonly name = "normalize_engineering_parameters";
  readonly description = "把原始输入归一化为标准参数集合；确定性函数。";
  readonly inputSchema = normalizeParamsInputSchema;
  readonly outputSchema = normalizeParamsOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof normalizeParamsInputSchema>,
  ): Promise<z.infer<typeof normalizeParamsOutputSchema>> {
    const { input: base, partialOverrides } = input;
    const merged: BlastScenarioInput = { ...base, ...(partialOverrides ?? {}) };
    const normalized = normalizeParameters(merged);
    return { normalized, notes: "归一化结果由确定性规则产生。" };
  }
}

class SearchKnowledgeTool
  implements AgentTool<z.infer<typeof searchKnowledgeInputSchema>, z.infer<typeof searchKnowledgeOutputSchema>>
{
  readonly name = "search_knowledge";
  readonly description = "检索 Demo 知识库；返回引用（documentId / 章节 / 命中片段 / 检索得分）。底层使用 RAG 管道，关键词 + 元数据为基线。";
  readonly inputSchema = searchKnowledgeInputSchema;
  readonly outputSchema = searchKnowledgeOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof searchKnowledgeInputSchema>,
  ): Promise<z.infer<typeof searchKnowledgeOutputSchema>> {
    const parsed = searchKnowledgeInputSchema.parse(input);
    const result = await getKnowledgeRepository().retrieve({
      query: parsed.query,
      categories:
        parsed.categories && parsed.categories.length > 0
          ? (parsed.categories.filter((c): c is KnowledgeCategory =>
              (KNOWLEDGE_CATEGORIES as readonly string[]).includes(c),
            ) as KnowledgeCategory[])
          : undefined,
      limit: parsed.limit,
    });
    return {
      citations: result.citations.map((c) => ({
        id: c.id,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        sourceType: c.sourceType,
        category: c.category,
        page: c.page,
        section: c.section,
        excerpt: c.excerpt,
        score: c.score,
        matchedTokens: [...c.matchedTokens],
        usedByAgents: [...c.usedByAgents],
        affectedConclusions: [...c.affectedConclusions],
      })),
    };
  }
}

class RunRuleCheckTool
  implements AgentTool<z.infer<typeof runRuleCheckInputSchema>, z.infer<typeof runRuleCheckOutputSchema>>
{
  readonly name = "run_rule_check";
  readonly description = "执行确定性工程规则预检查；输出 issues 与是否阻断。";
  readonly inputSchema = runRuleCheckInputSchema;
  readonly outputSchema = runRuleCheckOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof runRuleCheckInputSchema>,
  ): Promise<z.infer<typeof runRuleCheckOutputSchema>> {
    const safeInput = input.input ?? ({
      engineeringType: "open-pit-bench",
      rockCategory: "medium",
      environmentSensitivity: "low",
      freeTextNotes: "",
      costPreference: "balanced",
      convenienceRequirement: "medium",
    } as z.infer<typeof blastScenarioInputSchema>);
    const issues: RuleCheckIssue[] = runRulePrecheck(
      safeInput,
      input.normalized as unknown as NormalizedParameterSet,
    );
    const hasBlocking = issues.some((i) => i.severity === "danger");
    return {
      issues: issues.map((i) => ({
        code: i.code,
        message: i.message,
        severity: i.severity,
        ...(i.paramKey ? { paramKey: i.paramKey } : {}),
        ...(i.advice ? { advice: i.advice } : {}),
      })),
      hasBlocking,
    };
  }
}

class RunSafetyReviewTool
  implements
    AgentTool<z.infer<typeof runSafetyReviewInputSchema>, z.infer<typeof runSafetyReviewOutputSchema>>
{
  readonly name = "run_safety_review";
  readonly description = "运行结构化 Safety Reviewer：缺失参数 / 规则冲突 / 模型与规则 / 缺少引用 / 高风险字段；输出 checklist 与是否阻断。";
  readonly inputSchema = runSafetyReviewInputSchema;
  readonly outputSchema = runSafetyReviewOutputSchema;
  readonly highRisk = true;

  async execute(
    input: z.infer<typeof runSafetyReviewInputSchema>,
    ctx: ToolContext,
  ): Promise<z.infer<typeof runSafetyReviewOutputSchema>> {
    const parsed = runSafetyReviewInputSchema.parse(input);
    const result = runSafetyReview({
      input: parsed.input,
      normalized: parsed.normalized as unknown as NormalizedParameterSet,
      ruleIssues: parsed.ruleIssues as ReadonlyArray<RuleCheckIssue>,
      schemeSet: parsed.schemeSet as unknown as SchemeSet,
      citationCount: parsed.citationCount,
      risks: parsed.risks,
      reviews: parsed.reviews,
    });
    // 注册人工审批：所有 warning/block 项
    const items = result.items
      .filter((i) => i.severity !== "info")
      .map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        ownerRole: i.ownerRole,
        canBypass: i.canBypass,
      }));
    if (items.length > 0) {
      getHumanApprovalService().register({ runId: ctx.runId, items });
    }
    return {
      blocked: result.blocked,
      items: result.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        severity: i.severity,
        title: i.title,
        description: i.description,
        references: [...i.references],
        ownerRole: i.ownerRole,
        canBypass: i.canBypass,
      })),
      manualConfirmation: result.manualConfirmation.map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        references: [...i.references],
      })),
    };
  }
}

// 防止 lint 报未使用
void severityRank;
void kindLabel;

class CalculateSchemeScoreTool
  implements AgentTool<z.infer<typeof calculateScoreInputSchema>, z.infer<typeof calculateScoreOutputSchema>>
{
  readonly name = "calculate_scheme_score";
  readonly description = "调用确定性评分函数计算多维评分；不允许模型自行打分。";
  readonly inputSchema = calculateScoreInputSchema;
  readonly outputSchema = calculateScoreOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof calculateScoreInputSchema>,
  ): Promise<z.infer<typeof calculateScoreOutputSchema>> {
    void input.weightOverrides; // 权重当前仍由输入特征派生；保留扩展点
    // 当 input 缺省时，提供一个满足 blastScenarioInputSchema 的最小占位，
    // 使确定性评分函数仅依赖 normalized 与 category 工作（用于 Demo 评分单测）。
    const safeInput = input.input ?? ({
      engineeringType: "open-pit-bench",
      rockCategory: "medium",
      environmentSensitivity: "low",
      freeTextNotes: "",
      costPreference: "balanced",
      convenienceRequirement: "medium",
    } as z.infer<typeof blastScenarioInputSchema>);
    const score = calculateSchemeScore(
      safeInput,
      input.normalized as unknown as NormalizedParameterSet,
      input.category,
    );
    return { score };
  }
}

class AnalyzeParameterSensitivityTool
  implements
    AgentTool<
      z.infer<typeof analyzeSensitivityInputSchema>,
      z.infer<typeof analyzeSensitivityOutputSchema>
    >
{
  readonly name = "analyze_parameter_sensitivity";
  readonly description = "围绕 ±15% 区间计算参数敏感性矩阵。";
  readonly inputSchema = analyzeSensitivityInputSchema;
  readonly outputSchema = analyzeSensitivityOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof analyzeSensitivityInputSchema>,
  ): Promise<z.infer<typeof analyzeSensitivityOutputSchema>> {
    const result: SensitivityMatrix = analyzeSensitivity(
      input.input,
      input.normalized as unknown as NormalizedParameterSet,
      input.referenceScore,
    );
    return {
      axes: [...result.axes],
      cells: result.cells.map((c) => ({
        parameterKey: c.parameterKey,
        delta: c.delta,
        outputDelta: c.outputDelta,
      })),
    };
  }
}

class CompareSchemesTool
  implements
    AgentTool<z.infer<typeof compareSchemesInputSchema>, z.infer<typeof compareSchemesOutputSchema>>
{
  readonly name = "compare_schemes";
  readonly description = "对方案进行结构化对比；输出排序与差异。";
  readonly inputSchema = compareSchemesInputSchema;
  readonly outputSchema = compareSchemesOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof compareSchemesInputSchema>,
  ): Promise<z.infer<typeof compareSchemesOutputSchema>> {
    const schemes = input.schemes as unknown as readonly Scheme[];
    const ordered = sortSchemesByOverall(schemes);
    const ids = ordered.map((s) => s.id);
    const differences = computeDifferences(ordered);
    return { ordered: ids, differences };
  }
}

class RequestHumanApprovalTool
  implements
    AgentTool<
      z.infer<typeof requestHumanApprovalInputSchema>,
      z.infer<typeof requestHumanApprovalOutputSchema>
    >
{
  readonly name = "request_human_approval";
  readonly description = "创建人工审批节点；Demo 中以默认 approved=false 返回，并把待办注册到 Approval Service。";
  readonly inputSchema = requestHumanApprovalInputSchema;
  readonly outputSchema = requestHumanApprovalOutputSchema;
  readonly highRisk = true;

  async execute(
    input: z.infer<typeof requestHumanApprovalInputSchema>,
    ctx: ToolContext,
  ): Promise<z.infer<typeof requestHumanApprovalOutputSchema>> {
    // 将本次审批登记到 HumanApproval Service，便于 UI 与 Report 引用。
    const item = {
      id: `chk-${ctx.runId}-${ctx.stepId}`,
      title: input.prompt,
      severity: "block" as const,
      ownerRole: "safety-officer" as const,
      canBypass: false,
    };
    try {
      getHumanApprovalService().register({
        runId: ctx.runId,
        items: [item],
      });
    } catch (err) {
      // 即使注册失败也不影响 Agent 推进；UI 后续可重新登记。
      void err;
    }
    return {
      approved: false,
      approver: "pending",
      approvedAt: Date.now(),
      comment: `等待人工确认：${input.prompt}（理由：${input.reasons.join("; ") || "无"})`,
    };
  }
}

class BuildReportOutlineTool
  implements
    AgentTool<
      z.infer<typeof buildReportOutlineInputSchema>,
      z.infer<typeof buildReportOutlineOutputSchema>
    >
{
  readonly name = "build_report_outline";
  readonly description = "生成结构化报告大纲；默认包含责任边界。";
  readonly inputSchema = buildReportOutlineInputSchema;
  readonly outputSchema = buildReportOutlineOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof buildReportOutlineInputSchema>,
  ): Promise<z.infer<typeof buildReportOutlineOutputSchema>> {
    return {
      sections: [
        {
          key: "summary",
          title: "工程条件摘要",
          summary: `场景「${input.scenarioName}」的关键输入与约束。`,
        },
        {
          key: "prediction",
          title: "参数预测结果",
          summary: `推荐方案 ${input.recommendedSchemeId} 的装药、孔网与敏感性。`,
        },
        {
          key: "comparison",
          title: "方案对比",
          summary: "推荐 / 备选 / 风险方案的多维评分对比。",
        },
        {
          key: "review",
          title: "人工复核意见",
          summary: `共 ${input.reviewCount} 项待人工复核。`,
        },
        {
          key: "risks",
          title: "风险清单",
          summary: `识别 ${input.riskCount} 项风险。`,
        },
        {
          key: "responsibility",
          title: "责任边界",
          summary: "本报告为工程辅助演示，所有参数均为模拟预测，不构成现场施工指令。",
        },
      ],
    };
  }
}

/* ---------- 内部辅助 ---------- */

function computeDifferences(schemes: readonly Scheme[]): Array<{
  key: string;
  label: string;
  unit: string;
  values: Record<string, number>;
}> {
  const paramKeys = new Set<string>();
  const summaryMap = new Map<string, Map<string, { label: string; unit: string; value: number }>>();
  for (const s of schemes) {
    const m = new Map<string, { label: string; unit: string; value: number }>();
    for (const p of s.parameterSummary) {
      paramKeys.add(p.key);
      m.set(p.key, { label: p.label, unit: p.unit, value: p.value });
    }
    summaryMap.set(s.id, m);
  }
  const out: Array<{
    key: string;
    label: string;
    unit: string;
    values: Record<string, number>;
  }> = [];
  for (const key of paramKeys) {
    let label = key;
    let unit = "";
    const values: Record<string, number> = {};
    for (const s of schemes) {
      const m = summaryMap.get(s.id);
      const v = m?.get(key);
      if (v) {
        label = v.label;
        unit = v.unit;
        values[s.id] = v.value;
      }
    }
    if (Object.keys(values).length >= 2) {
      out.push({ key, label, unit, values });
    }
  }
  return out;
}

/* ---------- 知识库（Demo） ---------- */

/** 给前端使用的知识库索引（仅元数据，不含原文）。 */
export async function listKnowledgeIndex(): Promise<
  ReadonlyArray<{ id: string; title: string; category: string; sourceType: string }>
> {
  const docs = getKnowledgeRepository().listDocuments();
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    sourceType: d.sourceType,
  }));
}

/* ---------- Registry ---------- */

const TOOLS: Record<string, AgentTool<unknown, unknown>> = {
  normalize_engineering_parameters: new NormalizeEngineeringParametersTool() as AgentTool<
    unknown,
    unknown
  >,
  search_knowledge: new SearchKnowledgeTool() as AgentTool<unknown, unknown>,
  run_rule_check: new RunRuleCheckTool() as AgentTool<unknown, unknown>,
  run_safety_review: new RunSafetyReviewTool() as AgentTool<unknown, unknown>,
  calculate_scheme_score: new CalculateSchemeScoreTool() as AgentTool<unknown, unknown>,
  analyze_parameter_sensitivity: new AnalyzeParameterSensitivityTool() as AgentTool<
    unknown,
    unknown
  >,
  compare_schemes: new CompareSchemesTool() as AgentTool<unknown, unknown>,
  request_human_approval: new RequestHumanApprovalTool() as AgentTool<unknown, unknown>,
  build_report_outline: new BuildReportOutlineTool() as AgentTool<unknown, unknown>,
};

export function getTool<TInput = unknown, TOutput = unknown>(
  name: string,
): AgentTool<TInput, TOutput> {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`Tool 不存在：${name}`);
  return tool as AgentTool<TInput, TOutput>;
}

export function listTools(): readonly AgentTool<unknown, unknown>[] {
  return Object.values(TOOLS);
}

/** Citation → 输出（适配核心 Citation 类型）。 */
export function asCitation(input: {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceType: string;
  category: string;
  page?: number;
  section?: string;
  excerpt: string;
  score: number;
  matchedTokens: ReadonlyArray<string>;
  usedByAgents: ReadonlyArray<string>;
  affectedConclusions: ReadonlyArray<string>;
}): Citation {
  return {
    id: input.id,
    documentId: input.documentId,
    documentTitle: input.documentTitle,
    sourceType: input.sourceType,
    category: input.category,
    score: input.score,
    matchedTokens: [...input.matchedTokens],
    usedByAgents: [...input.usedByAgents],
    affectedConclusions: [...input.affectedConclusions],
    ...(input.page !== undefined ? { page: input.page } : {}),
    ...(input.section !== undefined ? { section: input.section } : {}),
    excerpt: input.excerpt,
  };
}

export type { RiskItem, RuleCheckIssue, SchemeSet };
export { fingerprintInput, generateSchemes, planParameters };
export type { ScoreWeights };
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
      category: z.string(),
      page: z.number().optional(),
      section: z.string().optional(),
      excerpt: z.string(),
      score: z.number().min(0).max(1),
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
  readonly description = "检索本地 Demo 知识库片段；返回引用与得分。";
  readonly inputSchema = searchKnowledgeInputSchema;
  readonly outputSchema = searchKnowledgeOutputSchema;
  readonly highRisk = false;

  async execute(
    input: z.infer<typeof searchKnowledgeInputSchema>,
  ): Promise<z.infer<typeof searchKnowledgeOutputSchema>> {
    const parsed = searchKnowledgeInputSchema.parse(input);
    const rawQuery = parsed.query.toLowerCase();
    // 兼容中文 / 英文 / 数字 token；中文按字符拆分
    const tokens = Array.from(
      new Set(
        rawQuery
          .split(/[\s,，。；;]+/)
          .flatMap((seg) =>
            /[一-龥]/.test(seg) ? Array.from(seg) : [seg],
          )
          .map((t) => t.toLowerCase())
          .filter(Boolean),
      ),
    );
    if (tokens.length === 0) {
      return { citations: [] };
    }
    const filtered = DEMO_KNOWLEDGE.filter(
      (d) =>
        !parsed.categories ||
        parsed.categories.length === 0 ||
        parsed.categories.includes(d.category),
    );
    const scored = filtered.map((doc) => {
      const haystack = `${doc.title} ${doc.excerpt}`.toLowerCase();
      let hits = 0;
      for (const t of tokens) if (haystack.includes(t)) hits += 1;
      const score = tokens.length === 0 ? 0 : Math.min(1, hits / tokens.length);
      return { doc, score };
    });
    const ranked = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, parsed.limit);
    return {
      citations: ranked.map((s) => ({
        id: `cit-${s.doc.id}`,
        documentId: s.doc.id,
        documentTitle: s.doc.title,
        category: s.doc.category,
        page: s.doc.page,
        section: s.doc.section,
        excerpt: s.doc.excerpt,
        score: Number(s.score.toFixed(3)),
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
  readonly description = "创建人工审批节点；Demo 中以默认 approved=false 返回。";
  readonly inputSchema = requestHumanApprovalInputSchema;
  readonly outputSchema = requestHumanApprovalOutputSchema;
  readonly highRisk = true;

  async execute(
    input: z.infer<typeof requestHumanApprovalInputSchema>,
  ): Promise<z.infer<typeof requestHumanApprovalOutputSchema>> {
    return {
      approved: false,
      approver: "pending",
      approvedAt: Date.now(),
      comment: `等待人工确认：${input.prompt}（理由：${input.reasons.join("; ")}）`,
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

interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  page?: number;
  section?: string;
  excerpt: string;
}

const DEMO_KNOWLEDGE: ReadonlyArray<KnowledgeDoc> = [
  {
    id: "doc-001",
    title: "爆破安全规程（GB 6722-2014）摘要",
    category: "规范",
    page: 12,
    section: "4.2 露天深孔台阶",
    excerpt: "露天深孔台阶爆破应按设计孔网参数、装药结构、最大单响药量进行控制。",
  },
  {
    id: "doc-002",
    title: "乳化炸药性能与适用场景",
    category: "材料",
    section: "2.3 抗水性",
    excerpt: "抗水性优于铵油炸药，适用于含水炮孔；建议临界直径不小于 25mm。",
  },
  {
    id: "doc-003",
    title: "城镇周边控制爆破案例库",
    category: "案例",
    page: 47,
    section: "案例 12",
    excerpt: "针对学校、居民区附近必须按允许振速 v=1.0 cm/s 进行试爆校核。",
  },
  {
    id: "doc-004",
    title: "节理裂隙岩体爆破参数建议",
    category: "教材",
    section: "3.1 孔距系数",
    excerpt: "节理发育岩体建议孔距系数取 1.0–1.2，并加密堵塞长度。",
  },
  {
    id: "doc-005",
    title: "高敏感环境最大单响估算",
    category: "规范",
    page: 18,
    section: "5.1 振动控制",
    excerpt: "高敏感环境应按 v ≤ 1.0 cm/s 控制，并通过试爆校核最大单响药量。",
  },
  {
    id: "doc-006",
    title: "隧道掘进装药结构经验",
    category: "教材",
    section: "4.4 间隔装药",
    excerpt: "隧道掘进常采用间隔装药结构并配置高精度雷管，减少单响药量。",
  },
];

/** 给前端使用的知识库索引（仅元数据，不含原文）。 */
export function listKnowledgeIndex(): readonly {
  id: string;
  title: string;
  category: string;
}[] {
  return DEMO_KNOWLEDGE.map((d) => ({ id: d.id, title: d.title, category: d.category }));
}

/* ---------- Registry ---------- */

const TOOLS: Record<string, AgentTool<unknown, unknown>> = {
  normalize_engineering_parameters: new NormalizeEngineeringParametersTool() as AgentTool<
    unknown,
    unknown
  >,
  search_knowledge: new SearchKnowledgeTool() as AgentTool<unknown, unknown>,
  run_rule_check: new RunRuleCheckTool() as AgentTool<unknown, unknown>,
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
export function asCitation(input: z.infer<typeof searchKnowledgeOutputSchema>["citations"][number]): Citation {
  return {
    id: input.id,
    documentId: input.documentId,
    documentTitle: input.documentTitle,
    category: input.category,
    score: input.score,
    ...(input.page !== undefined ? { page: input.page } : {}),
    ...(input.section !== undefined ? { section: input.section } : {}),
    excerpt: input.excerpt,
  };
}

export type { RiskItem, RuleCheckIssue, SchemeSet };
export { fingerprintInput, generateSchemes, planParameters };
export type { ScoreWeights };
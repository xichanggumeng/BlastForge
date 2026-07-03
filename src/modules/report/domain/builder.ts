import "server-only";

/**
 * Report Builder —— 把同一个 Planning Run + Citations + Approval 组合为一份 Report。
 *
 * 关键约束：
 *  - 报告数据全部来自传入的 run；不允许读取页面 / 随机数 / 当前时间以外的信息；
 *  - 章节顺序固定，便于跨场景对比；
 *  - 引用与人工复核快照必须原样落地到报告中。
 */

import { randomUUID } from "node:crypto";

import type { Scheme } from "@/modules/parameter-planning/domain/contracts";
import type { AwaitingApprovalSnapshot } from "@/modules/human-review/domain";
import type { BuildReportInput, Report, ReportSection } from "./contracts";

const RESPONSIBILITY_BOUNDARY = [
  "本报告由 BlastForge Demo 系统基于同一 Run 自动生成；不构成正式工程设计文件。",
  "报告中所有参数仅供工程条件讨论与方案对比；现场决策必须以现行规范、具备资质人员的签字与试爆校核为准。",
  "Demo Reviewer 接受人工确认不代表真实安全评估；任何高风险场景必须由具备资质的安全工程师签字。",
  "知识库引用为教学 / 模拟 / 摘要来源，不得作为正式规范条款引用；引用分数仅作可解释性参考。",
].join("\n");

export function buildReport(input: BuildReportInput): Report {
  const now = new Date().toISOString();
  const sections = buildSections(input);
  return {
    id: `rpt-${randomUUID()}`,
    runId: input.run.id,
    projectName: input.run.input.freeTextNotes || input.run.input.engineeringType,
    scenarioName: input.run.presetId ?? "Custom",
    status: input.approval && input.approval.pendingItems.length > 0 ? "pending-review" : "approved",
    replay: input.replay ?? false,
    sections,
    citations: input.citations.map((c) => ({
      ...c,
      matchedTokens: [...(c.matchedTokens ?? [])],
      affectedConclusions: [...(c.affectedConclusions ?? [])],
      usedByAgents: [...(c.usedByAgents ?? [])],
    })),
    approval: input.approval ?? null,
    generatedBy: input.generatedBy ?? "Demo Reporter",
    createdAt: now,
    updatedAt: now,
    responsibilityBoundary: RESPONSIBILITY_BOUNDARY,
  };
}

function buildSections(input: BuildReportInput): ReportSection[] {
  const { run, citations, approval } = input;
  const recommended = run.schemeSet.schemes.find((s) => s.id === run.schemeSet.recommendedId);
  const alternatives = run.schemeSet.schemes.filter((s) =>
    run.schemeSet.alternativeIds.includes(s.id),
  );
  const riskSchemes = run.schemeSet.schemes.filter((s) => run.schemeSet.riskIds.includes(s.id));

  return [
    {
      key: "cover",
      title: "封面",
      body: [
        `## 报告编号：${run.id}`,
        `**生成时间**：${run.createdAt}`,
        `**关联 Run**：${run.id}`,
        `**报告状态**：${approval && approval.pendingItems.length > 0 ? "待复核" : "已批准"}`,
        `**生成人**：${input.generatedBy ?? "Demo Reporter"}`,
        `**演示模式**：${input.replay ? "回放" : "真实调用"}`,
      ].join("\n"),
    },
    {
      key: "summary",
      title: "工程条件摘要",
      body: [
        `### 原始输入`,
        `- 工程类型：${run.input.engineeringType}`,
        `- 岩石等级：${run.input.rockCategory}`,
        `- 含水条件：${run.input.waterCondition ?? "—"}`,
        `- 环境敏感：${run.input.environmentSensitivity}`,
        `- 成本偏好：${run.input.costPreference}`,
        `- 施工便利性：${run.input.convenienceRequirement}`,
        `- 周边保护对象：${run.input.protectionTarget ?? "—"}`,
        run.input.freeTextNotes ? `- 备注：${run.input.freeTextNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      key: "normalized",
      title: "标准化参数",
      body: [
        `### 标准化结果`,
        `- 台阶高度：${run.normalized.benchHeight} m`,
        `- 孔径：${run.normalized.holeDiameter} mm`,
        `- 孔深：${run.normalized.holeDepth} m`,
        `- 孔距：${run.normalized.holeSpacing} m`,
        `- 排距：${run.normalized.rowSpacing} m`,
        `- 抵抗线：${run.normalized.burdenDistance} m`,
        `- 堵塞长度：${run.normalized.stemmingLength} m`,
        `- 最大单响：${run.normalized.maxChargePerDelay} kg`,
        `- 允许振速：${run.normalized.peakParticleVelocity} cm/s`,
        `- 装药结构：${run.normalized.chargeStructure}`,
      ].join("\n"),
    },
    {
      key: "rule-issues",
      title: "规则预检",
      body: renderRuleIssues(run.ruleIssues),
    },
    {
      key: "scheme-radar",
      title: "多方案雷达（评分维度）",
      body: renderSchemeRadarChart(recommended, alternatives, riskSchemes),
    },
    {
      key: "schemes",
      title: "推荐 / 备选 / 风险方案",
      body: renderSchemes(recommended, alternatives, riskSchemes),
    },
    {
      key: "scores",
      title: "评分概览",
      body: renderScores(run.schemeSet.schemes),
    },
    {
      key: "parameter-comparison",
      title: "参数对比（推荐 vs 备选 vs 风险）",
      body: renderParameterComparison(recommended, alternatives, riskSchemes),
    },
    {
      key: "sensitivity",
      title: "参数敏感性热力图",
      body: renderSensitivityHeatmap(run.sensitivity),
    },
    {
      key: "risks",
      title: "风险清单（分级）",
      body: renderRisks(run.risks, run.schemeSet),
    },
    {
      key: "reviews",
      title: "人工重点确认",
      body: renderReviews(run.reviews, approval),
    },
    {
      key: "citations",
      title: "知识引用",
      body: renderCitations(citations),
    },
    {
      key: "final-decision",
      title: "最终决策建议",
      body: renderFinalDecision(recommended, alternatives, riskSchemes, run.risks, run.reviews),
    },
    {
      key: "responsibility",
      title: "安全与责任边界",
      body: RESPONSIBILITY_BOUNDARY,
    },
  ];
}

function renderRuleIssues(
  issues: ReadonlyArray<{ code: string; message: string; severity: string }>,
): string {
  if (issues.length === 0) return "规则预检全部通过；未识别到阻断或提示。";
  return [`### 规则预检结果`, ...issues.map((i) => `- **[${i.severity}]** ${i.code}: ${i.message}`)].join(
    "\n",
  );
}

function renderSchemes(
  recommended: Scheme | undefined,
  alternatives: ReadonlyArray<Scheme>,
  riskSchemes: ReadonlyArray<Scheme>,
): string {
  const fmt = (s: Scheme | undefined) => {
    if (!s) return "_无_";
    const lines = [`- **${s.tag}** · ${s.category}`, `  - ${s.applicability}`];
    for (const p of s.predictedParameters.slice(0, 5)) {
      lines.push(`  - ${p.label}: ${p.value.toFixed(2)} ${p.unit}`);
    }
    return lines.join("\n");
  };
  return [
    `### 推荐方案`,
    fmt(recommended),
    `### 备选方案`,
    alternatives.length > 0 ? alternatives.map(fmt).join("\n") : "_无_",
    `### 风险 / 不推荐方案`,
    riskSchemes.length > 0 ? riskSchemes.map(fmt).join("\n") : "_无_",
  ].join("\n");
}

function renderScores(schemes: ReadonlyArray<Scheme>): string {
  if (schemes.length === 0) return "无评分数据。";
  return [
    `### 多维评分`,
    ...schemes.map(
      (s) =>
        `- ${s.tag} (${s.id})：安全 ${s.score.safety.toFixed(0)} · 适配 ${s.score.suitability.toFixed(0)} · 经济 ${s.score.economy.toFixed(0)} · 便利 ${s.score.convenience.toFixed(0)} · 环境 ${s.score.environment.toFixed(0)} · 综合 ${s.score.overall.toFixed(0)}`,
    ),
  ].join("\n");
}

/**
 * 多方案雷达图：以六维评分（安全/适配/经济/便利/环境/综合）为坐标，
 * 把推荐 / 备选 / 风险三类方案分别铺在 SVG 雷达上。
 * 数据以 JSON 形式存入 body（sentinel: `::chart-radar::{...}::`），
 * exporters 中 HTML/PDF 路径会解析此 sentinel 并输出 SVG；Markdown 路径保留 JSON 原文。
 */
function renderSchemeRadarChart(
  recommended: Scheme | undefined,
  alternatives: ReadonlyArray<Scheme>,
  riskSchemes: ReadonlyArray<Scheme>,
): string {
  const schemesForChart = [
    ...(recommended ? [{ tag: recommended.tag, tone: "primary", score: recommended.score }] : []),
    ...alternatives.map((s) => ({ tag: s.tag, tone: "neutral", score: s.score })),
    ...riskSchemes.map((s) => ({ tag: s.tag, tone: "danger", score: s.score })),
  ];
  if (schemesForChart.length === 0) return "_无可对比方案_";
  return [
    "### 多方案雷达（推荐 / 备选 / 风险）",
    "六个评分维度同步比较；推荐方案（橙）作为锚点。",
    `::chart-radar::${JSON.stringify({ schemes: schemesForChart })}::`,
  ].join("\n");
}

/**
 * 参数对比（柱状）：取所有方案的 predictedParameters 并集；
 * 每行展示一个参数 label，三类方案（推荐 / 备选 / 风险）多列柱状对照。
 */
function renderParameterComparison(
  recommended: Scheme | undefined,
  alternatives: ReadonlyArray<Scheme>,
  riskSchemes: ReadonlyArray<Scheme>,
): string {
  const groups: { tag: string; tone: string; parameters: ReadonlyArray<{ label: string; value: number; unit: string }> }[] = [
    ...(recommended ? [{ tag: recommended.tag, tone: "primary", parameters: recommended.predictedParameters }] : []),
    ...alternatives.map((s) => ({ tag: s.tag, tone: "neutral", parameters: s.predictedParameters })),
    ...riskSchemes.map((s) => ({ tag: s.tag, tone: "danger", parameters: s.predictedParameters })),
  ];
  if (groups.length === 0) return "_无可对比方案_";

  // 收集并集 label
  const labelMap = new Map<string, { unit: string }>();
  for (const g of groups) {
    for (const p of g.parameters) {
      if (!labelMap.has(p.label)) labelMap.set(p.label, { unit: p.unit });
    }
  }
  const rows = Array.from(labelMap.entries()).map(([label, { unit }]) => {
    const values: Record<string, number | null> = {};
    for (const g of groups) {
      const hit = g.parameters.find((p) => p.label === label);
      values[g.tag] = hit ? Number(hit.value.toFixed(2)) : null;
    }
    return { label, unit, values };
  });

  return [
    "### 关键参数对比（柱状）",
    "横向柱状展示推荐 / 备选 / 风险方案在每项参数上的取值（null 表示未给出）。",
    `::chart-bars::${JSON.stringify({ schemes: groups.map((g) => ({ tag: g.tag, tone: g.tone })), rows })}::`,
  ].join("\n");
}

/**
 * 参数敏感性热力图：把 sensitivity.cells 渲染成 (axes × delta) 二维矩阵。
 * 输出绝对响应强度（|outputDelta|）的色阶，提示哪些参数偏移对综合评分影响最大。
 */
function renderSensitivityHeatmap(sensitivity: { axes: readonly string[]; cells: readonly { parameterKey: string; delta: number; outputDelta: number }[] }): string {
  if (sensitivity.axes.length === 0 || sensitivity.cells.length === 0) return "_本次 Run 未生成敏感性分析_";

  // 列：从 cells 中提炼去重 delta，排序
  const deltas = Array.from(new Set(sensitivity.cells.map((c) => c.delta))).sort((a, b) => a - b);
  const axes = sensitivity.axes;
  // 矩阵：axes × deltas
  const matrix: Record<string, Record<number, number>> = {};
  for (const axis of axes) matrix[axis] = {};
  for (const c of sensitivity.cells) {
    if (!matrix[c.parameterKey]) matrix[c.parameterKey] = {};
    matrix[c.parameterKey]![c.delta] = Number(c.outputDelta.toFixed(2));
  }

  // 计算响应强度阈值用于颜色提示
  const absValues = sensitivity.cells.map((c) => Math.abs(c.outputDelta));
  const maxAbs = absValues.length > 0 ? Math.max(...absValues) : 1;

  return [
    "### 敏感性热力图（参数 × 微调幅度 → 综合评分响应）",
    `响应强度（|outputDelta|）上限 ${maxAbs.toFixed(2)}；颜色越深表示该参数偏移对综合评分影响越大。`,
    `::chart-heatmap::${JSON.stringify({ axes, deltas, matrix, maxAbs })}::`,
  ].join("\n");
}

/**
 * 风险清单（分级）：按 level（high / medium / low）三段呈现；
 * 每条标注 level / 关联方案 / 关联参数 / 建议。
 */
type RiskRecord = { id: string; title: string; description: string; level: string; schemeId?: string; paramKey?: string };
type RiskBucket = RiskRecord[];

function renderRisks(
  risks: ReadonlyArray<RiskRecord>,
  schemeSet: { recommendedId: string; alternativeIds: readonly string[]; riskIds: readonly string[]; schemes: readonly Scheme[] },
): string {
  if (risks.length === 0) return "当前 Run 未识别到新增风险。";
  const buckets: { high: RiskBucket; medium: RiskBucket; low: RiskBucket } = { high: [], medium: [], low: [] };
  for (const r of risks) {
    const lvl = (r.level ?? "low") as keyof typeof buckets;
    if (buckets[lvl]) buckets[lvl].push(r);
    else buckets.low.push(r);
  }
  const schemeTag = (id?: string): string => {
    if (!id) return "—";
    const s = schemeSet.schemes.find((x) => x.id === id);
    return s?.tag ?? id;
  };
  const lines: string[] = ["### 风险分级统计", "| 等级 | 数量 |", "| --- | --- |"];
  lines.push(`| high | ${buckets.high.length} |`);
  lines.push(`| medium | ${buckets.medium.length} |`);
  lines.push(`| low | ${buckets.low.length} |`);
  lines.push("");
  for (const key of ["high", "medium", "low"] as const) {
    const list = buckets[key];
    if (list.length === 0) continue;
    lines.push(`### ${key.toUpperCase()}（${list.length}）`);
    for (const r of list) {
      lines.push(
        `- **[${r.level}]** ${r.title}` +
          (r.description ? `：${r.description}` : "") +
          (r.schemeId ? ` · 关联方案：${schemeTag(r.schemeId)}` : "") +
          (r.paramKey ? ` · 关联参数：${r.paramKey}` : ""),
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * 人工重点确认（来自 PlanningRun.reviews + approval 快照）。
 * reviews 是规划阶段静态识别的人工复核项；approval 是审批服务的动态状态。
 * 两个组合输出"重点关注项" + "审批动态"。
 */
function renderReviews(
  reviews: ReadonlyArray<{ id: string; paramKey?: string; schemeId?: string; reason: string; level: "low" | "medium" | "high" }>,
  approval: AwaitingApprovalSnapshot | null,
): string {
  const lines: string[] = [];
  if (reviews.length > 0) {
    lines.push("### 重点关注项（规划阶段识别）");
    lines.push("| 等级 | 复核理由 | 关联参数 | 关联方案 |");
    lines.push("| --- | --- | --- | --- |");
    for (const r of reviews) {
      lines.push(
        `| ${r.level} | ${r.reason} | ${r.paramKey ?? "—"} | ${r.schemeId ?? "—"} |`,
      );
    }
    lines.push("");
  }
  if (!approval) {
    lines.push("### 审批动态", "本次 Run 未触发审批服务记录（属本地 Demo 流程）。");
    return lines.join("\n");
  }
  lines.push("### 审批动态");
  lines.push(`- 当前状态：${approval.status}`);
  lines.push(`- 最后更新：${approval.updatedAt}`);
  lines.push(`- 待确认条目：${approval.pendingItems.length}`);
  for (const item of approval.pendingItems) {
    lines.push(`  - **[${item.severity}]** ${item.title}（${item.ownerRole}）`);
  }
  if (approval.history.length > 0) {
    lines.push(`- 历史审批：${approval.history.length} 条（最近 5 条）`);
    for (const h of approval.history.slice(0, 5)) {
      lines.push(
        `  - ${h.createdAt.slice(0, 19).replace("T", " ")} · ${h.reviewer.name}（${h.reviewer.role}）· ${h.status}：${h.comment}`,
      );
    }
  }
  return lines.join("\n");
}

/**
 * 最终决策建议：综合推荐方案 + 备选 + 风险，输出
 *   1) 推荐方案 + 推荐理由（top-3 维度）
 *   2) 备选理由（什么场景切换到备选）
 *   3) 风险提醒（哪些点会让推荐失效）
 *   4) 决策结论（一句话）
 */
function renderFinalDecision(
  recommended: Scheme | undefined,
  alternatives: ReadonlyArray<Scheme>,
  riskSchemes: ReadonlyArray<Scheme>,
  risks: ReadonlyArray<{ level: string; title: string; schemeId?: string }>,
  reviews: ReadonlyArray<{ level: string; reason: string }>,
): string {
  if (!recommended) return "_无可推荐的方案_";

  // 推荐方案 top-3 维度（按分数排，安全/适配/经济/便利/环境/综合）
  const dims = [
    { key: "safety", label: "安全", value: recommended.score.safety },
    { key: "suitability", label: "适配", value: recommended.score.suitability },
    { key: "economy", label: "经济", value: recommended.score.economy },
    { key: "convenience", label: "便利", value: recommended.score.convenience },
    { key: "environment", label: "环境", value: recommended.score.environment },
  ];
  const topDims = [...dims].sort((a, b) => b.value - a.value).slice(0, 3);

  // 关联到推荐方案的高 / 中级风险
  const recRisks = risks.filter((r) => r.schemeId === recommended.id || r.schemeId === undefined);

  // 高 / 中级复核项
  const keyReviews = reviews.filter((r) => r.level !== "low");

  const lines: string[] = [
    "### 推荐方案",
    `**${recommended.tag}** · ${recommended.applicability}`,
    `- 综合评分：${recommended.score.overall.toFixed(0)}`,
    `- 推荐理由：${topDims.map((d) => `${d.label} ${d.value.toFixed(0)}`).join("、")}`,
    recommended.note ? `- 关键说明：${recommended.note}` : "",
  ].filter(Boolean);
  lines.push("");

  if (alternatives.length > 0) {
    lines.push("### 备选触发条件");
    for (const a of alternatives) {
      lines.push(`- **${a.tag}**（综合 ${a.score.overall.toFixed(0)}）：${a.applicability}`);
    }
    lines.push("");
  }

  if (riskSchemes.length > 0) {
    lines.push("### 风险方案（不推荐）");
    for (const s of riskSchemes) {
      lines.push(`- **${s.tag}**（综合 ${s.score.overall.toFixed(0)}）：${s.applicability}`);
    }
    lines.push("");
  }

  if (recRisks.length > 0) {
    lines.push("### 失效条件（推荐方案风险点）");
    for (const r of recRisks) {
      lines.push(`- **[${r.level}]** ${r.title}`);
    }
    lines.push("");
  }

  if (keyReviews.length > 0) {
    lines.push("### 必须人工复核的关键项");
    for (const r of keyReviews) {
      lines.push(`- **[${r.level}]** ${r.reason}`);
    }
    lines.push("");
  }

  lines.push("### 决策结论");
  lines.push(
    recommended.note
      ? `基于当前工程条件与多维评分，推荐采用 **${recommended.tag}**（综合 ${recommended.score.overall.toFixed(0)}）；${recommended.note}`
      : `基于当前工程条件与多维评分，推荐采用 **${recommended.tag}**（综合 ${recommended.score.overall.toFixed(0)}）；如高 / 中级复核项确认通过则进入实施。`,
  );

  return lines.join("\n");
}

function renderCitations(
  citations: ReadonlyArray<{
    id: string;
    documentTitle: string;
    excerpt: string;
    score: number;
    category: string;
    matchedTokens?: ReadonlyArray<string>;
    usedByAgents?: ReadonlyArray<string>;
    affectedConclusions?: ReadonlyArray<string>;
  }>,
): string {
  if (citations.length === 0)
    return "本次 Run 未命中任何知识引用；请在 Planner 内主动补充检索。";
  return [
    `### 引用片段（${citations.length}）`,
    ...citations.map(
      (c) =>
        `- **${c.documentTitle}**（${c.category} · 得分 ${(c.score * 100).toFixed(0)}%）：${c.excerpt}` +
        (c.matchedTokens && c.matchedTokens.length > 0
          ? `\n  - 命中关键词：${c.matchedTokens.slice(0, 8).join("、")}`
          : "") +
        (c.usedByAgents && c.usedByAgents.length > 0
          ? `\n  - 使用 Agent：${c.usedByAgents.join("、")}`
          : "") +
        (c.affectedConclusions && c.affectedConclusions.length > 0
          ? `\n  - 影响结论：${c.affectedConclusions.join("、")}`
          : ""),
    ),
  ].join("\n");
}

// 旧的 renderApproval 已并入 renderReviews。
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
      key: "risks",
      title: "风险清单",
      body: renderRisks(run.risks),
    },
    {
      key: "citations",
      title: "知识引用",
      body: renderCitations(citations),
    },
    {
      key: "approval",
      title: "人工复核",
      body: renderApproval(approval),
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

function renderRisks(
  risks: ReadonlyArray<{ id: string; title: string; description: string; level: string }>,
): string {
  if (risks.length === 0) return "当前 Run 未识别到新增风险。";
  return [
    `### 风险清单`,
    ...risks.map((r) => `- **[${r.level}]** ${r.title}：${r.description}`),
  ].join("\n");
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

function renderApproval(approval: AwaitingApprovalSnapshot | null): string {
  if (!approval) {
    return "本次 Run 未触发人工复核节点。";
  }
  const lines = [
    `### 复核状态：${approval.status}`,
    `最后更新：${approval.updatedAt}`,
    `待确认条目：${approval.pendingItems.length}`,
  ];
  for (const item of approval.pendingItems) {
    lines.push(`- **[${item.severity}]** ${item.title}（${item.ownerRole}）`);
  }
  lines.push(`历史审批：${approval.history.length} 条`);
  for (const h of approval.history.slice(0, 5)) {
    lines.push(
      `- ${h.createdAt.slice(0, 19).replace("T", " ")} · ${h.reviewer.name}（${h.reviewer.role}）· ${h.status}：${h.comment}`,
    );
  }
  return lines.join("\n");
}
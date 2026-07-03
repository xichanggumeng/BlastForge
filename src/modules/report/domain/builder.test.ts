/**
 * Report 模块单元测试。
 *
 * 覆盖：
 *  - buildReport 不重复生成随机数据；
 *  - sections 必须包含封面 / 引用 / 责任边界；
 *  - Markdown / HTML / JSON 导出可用；
 *  - report.approval 缺失时 status=approved。
 */

import { describe, expect, it } from "vitest";

import {
  buildReport,
  exportHTML,
  exportJSON,
  exportMarkdown,
} from "@/modules/report/domain";
import type { PlanningRun } from "@/modules/parameter-planning/domain/contracts";
import type { Citation } from "@/modules/agent-runtime/core/contracts";

const RUN_ID = "run-test-rpt-001";

function makeRun(): PlanningRun {
  return {
    id: RUN_ID,
    projectId: "proj-1",
    presetId: "standard",
    input: {
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
      freeTextNotes: "",
      benchHeight: 12,
      holeDiameter: 138,
      holeDepth: 12.5,
      stemmingLength: 3.2,
      targetFragmentation: 60,
      peakParticleVelocity: 5,
      flyrockRisk: "low",
    },
    normalized: {
      engineeringTypeLabel: "open-pit-bench",
      rockCategoryLabel: "medium",
      protodyakonov: 8,
      benchHeight: 12,
      holeDiameter: 138,
      holeDepth: 12.5,
      stemmingLength: 3.2,
      holeSpacing: 5.1,
      rowSpacing: 4.3,
      burdenDistance: 4.5,
      chargeStructure: "coupled",
      maxChargePerDelay: 80,
      peakParticleVelocity: 1.5,
      linearChargeDensity: 12,
      totalChargeKg: 320,
    },
    ruleIssues: [
      {
        code: "MAX_CHARGE_OK",
        message: "最大单响在允许范围",
        severity: "info",
      },
    ],
    schemeSet: {
      schemes: [
        {
          id: "scheme-r",
          category: "recommended",
          label: "推荐方案",
          tag: "推荐 A",
          applicability: "标准露天中硬岩",
          parameterSummary: [],
          predictedParameters: [
            {
              key: "holeSpacing",
              label: "孔距",
              value: 5.1,
              unit: "m",
              range: { min: 4.5, max: 5.5 },
              source: "rule",
              sourceKind: "rule",
              confidenceLevel: "high",
              rationale: "标准化结果",
              requiresReview: false,
            },
          ],
          score: {
            safety: 80,
            suitability: 85,
            economy: 70,
            convenience: 75,
            environment: 80,
            overall: 78,
          },
          risks: [],
        },
      ],
      recommendedId: "scheme-r",
      alternativeIds: [],
      riskIds: [],
    },
    risks: [],
    reviews: [],
    sensitivity: { axes: [], cells: [] },
    steps: [],
    status: "succeeded",
    selectedSchemeId: "scheme-r",
    createdAt: "2026-07-04T10:00:00+08:00",
  };
}

function makeCitations(): Citation[] {
  return [
    {
      id: "cit-1",
      documentId: "KB-DOC-001",
      documentTitle: "常用炸药类型与适用条件（教学摘要）",
      category: "explosive",
      excerpt: "乳化炸药适用于含水炮孔；临界直径不小于 25mm。",
      score: 0.85,
      matchedTokens: ["乳化", "含水"],
      affectedConclusions: ["maxChargePerDelay"],
      usedByAgents: ["retriever", "planner"],
    },
  ];
}

describe("buildReport", () => {
  it("生成 report 时使用传入的 runId", () => {
    const report = buildReport({
      run: makeRun(),
      citations: makeCitations(),
      approval: null,
    });
    expect(report.runId).toBe(RUN_ID);
    expect(report.sections.find((s) => s.key === "cover")).toBeDefined();
    expect(report.sections.find((s) => s.key === "citations")).toBeDefined();
    expect(report.sections.find((s) => s.key === "responsibility")).toBeDefined();
    expect(report.status).toBe("approved");
  });

  it("approval 待确认时 report 状态变为 pending-review", () => {
    const report = buildReport({
      run: makeRun(),
      citations: makeCitations(),
      approval: {
        runId: RUN_ID,
        status: "waiting_for_approval",
        pendingItems: [
          {
            id: "chk-1",
            title: "需要复核",
            severity: "block",
            ownerRole: "safety-officer",
            canBypass: false,
          },
        ],
        history: [] as ReadonlyArray<never>,
        updatedAt: "2026-07-04T10:00:00+08:00",
      },
    });
    expect(report.status).toBe("pending-review");
  });

  it("report citations 包含原始 matchedTokens", () => {
    const report = buildReport({
      run: makeRun(),
      citations: makeCitations(),
      approval: null,
    });
    const first = report.citations[0] as { id: string; matchedTokens: string[] } | undefined;
    expect(first?.id).toBe("cit-1");
    expect(first?.matchedTokens).toContain("乳化");
  });
});

describe("Exporters", () => {
  it("Markdown 导出含标题 / 章节 / 责任边界", () => {
    const report = buildReport({
      run: makeRun(),
      citations: makeCitations(),
      approval: null,
    });
    const md = exportMarkdown(report);
    expect(md).toContain(`# 报告 ${report.id}`);
    expect(md).toContain("工程条件摘要");
    expect(md).toContain("责任边界");
  });

  it("HTML 导出含 <html> 标签与 CSS 打印样式 + 报告头部 + @page 页眉页脚", () => {
    const report = buildReport({
      run: makeRun(),
      citations: makeCitations(),
      approval: null,
    });
    const html = exportHTML(report);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("@media print");
    expect(html).toContain("责任边界");
    // 已无封面页：封面应被替换为内联报告头部（不占一页）。
    expect(html).not.toMatch(/<section[^>]*class="[^"]*\bcover\b/);
    expect(html).toContain('class="report-head"');
    expect(html).toMatch(/<header class="report-head">/);
    expect(html).toContain("@page"); // 分页与页码
    expect(html).toContain("counter(page)"); // 页码
    expect(html).toContain("推荐 / 备选 / 风险方案"); // 评分卡章节标题
    expect(html).toContain(".scheme-card"); // 评分卡 CSS
    expect(html).toContain(".citation-card"); // 引用卡 CSS
  });

  it("builder 生成雷达 / 柱状 / 热力 三个图表章节与最终决策章节", () => {
    const run = makeRun();
    // 注入敏感性 + 多个方案让图表有内容
    run.schemeSet.alternativeIds = ["scheme-a"];
    run.schemeSet.riskIds = ["scheme-x"];
    run.schemeSet.schemes = [
      ...run.schemeSet.schemes,
      {
        id: "scheme-a",
        category: "alternative",
        label: "备选方案",
        tag: "备选 B",
        applicability: "替代配置",
        parameterSummary: [],
        predictedParameters: [
          { key: "holeSpacing", label: "孔距", value: 5.5, unit: "m", range: { min: 4.5, max: 6 }, source: "rule", sourceKind: "rule", confidenceLevel: "high", rationale: "替代", requiresReview: false },
        ],
        score: { safety: 75, suitability: 78, economy: 80, convenience: 70, environment: 72, overall: 76 },
        risks: [],
      },
      {
        id: "scheme-x",
        category: "risk",
        label: "风险方案",
        tag: "风险 C",
        applicability: "高风险配置",
        parameterSummary: [],
        predictedParameters: [
          { key: "holeSpacing", label: "孔距", value: 6.5, unit: "m", range: { min: 4.5, max: 8 }, source: "rule", sourceKind: "rule", confidenceLevel: "low", rationale: "激进", requiresReview: true },
        ],
        score: { safety: 50, suitability: 60, economy: 90, convenience: 65, environment: 55, overall: 60 },
        risks: ["单耗过高", "振动超限"],
      },
    ];
    run.risks = [
      { id: "rk1", title: "振动接近上限", description: "实测振速接近阈值", level: "high", schemeId: "scheme-r", paramKey: "maxChargePerDelay" },
      { id: "rk2", title: "块度偏大", description: "目标块度偏高", level: "medium", schemeId: "scheme-r" },
    ];
    run.reviews = [
      { id: "rv1", reason: "最大单响超出推荐区间", level: "high", paramKey: "maxChargePerDelay", schemeId: "scheme-r" },
      { id: "rv2", reason: "孔距偏激进", level: "medium", schemeId: "scheme-a" },
    ];
    run.sensitivity = {
      axes: ["holeSpacing", "stemmingLength"],
      cells: [
        { parameterKey: "holeSpacing", delta: -2, outputDelta: 4.5 },
        { parameterKey: "holeSpacing", delta: 0, outputDelta: 0 },
        { parameterKey: "holeSpacing", delta: 2, outputDelta: -3.2 },
        { parameterKey: "stemmingLength", delta: -1, outputDelta: -1.8 },
        { parameterKey: "stemmingLength", delta: 1, outputDelta: 2.1 },
      ],
    };

    const report = buildReport({ run, citations: makeCitations(), approval: null });
    const keys = report.sections.map((s) => s.key);
    expect(keys).toContain("scheme-radar");
    expect(keys).toContain("parameter-comparison");
    expect(keys).toContain("sensitivity");
    expect(keys).toContain("reviews");
    expect(keys).toContain("final-decision");

    // 雷达 / 柱 / 热力 章节 body 都包含 JSON 哨兵
    const radar = report.sections.find((s) => s.key === "scheme-radar")?.body ?? "";
    expect(radar).toMatch(/::chart-radar::/);
    const bars = report.sections.find((s) => s.key === "parameter-comparison")?.body ?? "";
    expect(bars).toMatch(/::chart-bars::/);
    const heat = report.sections.find((s) => s.key === "sensitivity")?.body ?? "";
    expect(heat).toMatch(/::chart-heatmap::/);

    // 风险分级表 + 重点确认表 + 决策结论段落都到位
    const risksSection = report.sections.find((s) => s.key === "risks")?.body ?? "";
    expect(risksSection).toMatch(/风险分级统计/);
    expect(risksSection).toMatch(/### HIGH/);
    expect(risksSection).toMatch(/### MEDIUM/);
    const reviewsSection = report.sections.find((s) => s.key === "reviews")?.body ?? "";
    expect(reviewsSection).toMatch(/重点关注项/);
    expect(reviewsSection).toMatch(/审批动态/);
    const finalSection = report.sections.find((s) => s.key === "final-decision")?.body ?? "";
    expect(finalSection).toMatch(/### 推荐方案/);
    expect(finalSection).toMatch(/### 决策结论/);
    expect(finalSection).toMatch(/备选触发条件|备选 B/);
  });

  it("HTML 导出解析 chart 哨兵并生成 SVG 雷达 / 柱状 / 热力", () => {
    const run = makeRun();
    run.schemeSet.alternativeIds = ["scheme-a"];
    run.schemeSet.schemes = [
      ...run.schemeSet.schemes,
      {
        id: "scheme-a",
        category: "alternative",
        label: "备选方案",
        tag: "备选 B",
        applicability: "替代",
        parameterSummary: [],
        predictedParameters: [
          { key: "holeSpacing", label: "孔距", value: 5.5, unit: "m", range: { min: 4.5, max: 6 }, source: "rule", sourceKind: "rule", confidenceLevel: "high", rationale: "替代", requiresReview: false },
        ],
        score: { safety: 75, suitability: 78, economy: 80, convenience: 70, environment: 72, overall: 76 },
        risks: [],
      },
    ];
    run.risks = [
      { id: "rk1", title: "振动接近上限", description: "实测振速接近阈值", level: "high", schemeId: "scheme-r", paramKey: "maxChargePerDelay" },
      { id: "rk2", title: "块度偏大", description: "目标块度偏高", level: "medium", schemeId: "scheme-r" },
    ];
    run.reviews = [
      { id: "rv1", reason: "最大单响超出推荐区间", level: "high", paramKey: "maxChargePerDelay", schemeId: "scheme-r" },
    ];
    run.sensitivity = {
      axes: ["holeSpacing"],
      cells: [
        { parameterKey: "holeSpacing", delta: -1, outputDelta: 2 },
        { parameterKey: "holeSpacing", delta: 1, outputDelta: -3 },
      ],
    };
    const report = buildReport({ run, citations: [], approval: null });
    const html = exportHTML(report);
    // 哨兵被解析（不再出现 ::chart-...::）
    expect(html).not.toMatch(/::chart-(radar|bars|heatmap)::/);
    // 雷达 SVG 出现，且内部多边形不被 <p> 包裹
    expect(html).toMatch(/<svg class="radar-svg"[\s\S]*?<\/svg>/);
    expect(html).not.toMatch(/<p>[^<]*<polygon/); // 多边形行不能被包在 <p> 里
    expect(html).not.toMatch(/<p>[^<]*<line\s+class="radar/); // 雷达轴线不能被包在 <p> 里
    // 柱状 row 出现，且内部 div 不被 <p> 包裹
    expect(html).toMatch(/<div class="bar-row"/);
    expect(html).not.toMatch(/<p>[^<]*<div class="bar-row/);
    // 热力图 table 出现
    expect(html).toMatch(/<table class="heatmap-table"/);
    // 决策卡片
    expect(html).toMatch(/class="decision-card"/);
    // 风险 / 复核 提示
    expect(html).toMatch(/class="risk-summary"/);
    expect(html).toMatch(/class="review-hint"/);
  });

  it("风险分级章节的 markdown 表格被渲染为 <table class=\"md-table\">", () => {
    const run = makeRun();
    run.risks = [
      { id: "rk1", title: "振动接近上限", description: "实测振速接近阈值", level: "high", schemeId: "scheme-r", paramKey: "maxChargePerDelay" },
      { id: "rk2", title: "块度偏大", description: "目标块度偏高", level: "medium", schemeId: "scheme-r" },
      { id: "rk3", title: "参数微调", description: "孔距微调", level: "low", schemeId: "scheme-r" },
    ];
    const report = buildReport({ run, citations: [], approval: null });
    const html = exportHTML(report);
    expect(html).toMatch(/<table class="md-table">/);
    // HIGH / MEDIUM / LOW 三段标题（H3->h4）被渲染
    expect(html).toMatch(/<h4>HIGH（\d+）<\/h4>|<h4>MEDIUM（\d+）<\/h4>|<h4>LOW（\d+）<\/h4>/);
    // 不再出现未渲染的 markdown 源代码（'### HIGH'）
    expect(html).not.toMatch(/<p>### HIGH/);
    expect(html).not.toMatch(/<p>### MEDIUM/);
    expect(html).not.toMatch(/<p>### LOW/);
  });

  it("封面页已删除，报告头部改为 report-head", () => {
    const report = buildReport({ run: makeRun(), citations: [], approval: null });
    const html = exportHTML(report);
    expect(html).not.toMatch(/<section[^>]*class="[^"]*\bcover\b/);
    expect(html).toContain('<header class="report-head">');
    // 封面里的居中标题块已不在（h1 移到 .report-head 内，且不再居中占整页）
    expect(html).not.toContain('class="cover report-section"');
  });

  it("JSON 导出是合法 JSON", () => {
    const report = buildReport({
      run: makeRun(),
      citations: makeCitations(),
      approval: null,
    });
    const json = exportJSON(report);
    const parsed = JSON.parse(json) as { id: string; sections: unknown[] };
    expect(parsed.id).toBe(report.id);
    expect(parsed.sections.length).toBeGreaterThan(0);
  });
});
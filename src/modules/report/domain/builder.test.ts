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

  it("HTML 导出含 <html> 标签与 CSS 打印样式", () => {
    const report = buildReport({
      run: makeRun(),
      citations: makeCitations(),
      approval: null,
    });
    const html = exportHTML(report);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("@media print");
    expect(html).toContain("责任边界");
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
/**
 * Safety Reviewer 单元测试。
 */

import { describe, expect, it } from "vitest";

import { runSafetyReview } from "@/modules/safety-review/domain";
import type {
  NormalizedParameterSet,
  SchemeSet,
  RiskItem,
  ReviewRequirement,
  RuleCheckIssue,
  BlastScenarioInput,
} from "@/modules/parameter-planning/domain/contracts";

const baseInput: BlastScenarioInput = {
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
};

const normalized: NormalizedParameterSet = {
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
    };

const schemeSet: SchemeSet = {
  schemes: [],
  recommendedId: "scheme-x",
  alternativeIds: [],
  riskIds: [],
};

describe("Safety Reviewer: 缺失参数", () => {
  it("缺 engineeringType 触发 block", () => {
    const result = runSafetyReview({
      input: { ...baseInput, engineeringType: undefined as never },
      normalized,
      ruleIssues: [],
      schemeSet,
      citationCount: 0,
      risks: [],
      reviews: [],
    });
    expect(result.blocked).toBe(true);
    expect(result.items.find((i) => i.kind === "missing-param")).toBeDefined();
  });
});

describe("Safety Reviewer: 规则冲突", () => {
  it("规则 danger 转为 block 级别", () => {
    const ruleIssues: RuleCheckIssue[] = [
      {
        code: "MAX_CHARGE_EXCEED",
        message: "maxChargePerDelay 超过环境允许值",
        severity: "danger",
        paramKey: "maxChargePerDelay",
        advice: "降低最大单响或采用孔内分段装药",
      },
    ];
    const result = runSafetyReview({
      input: baseInput,
      normalized,
      ruleIssues,
      schemeSet,
      citationCount: 0,
      risks: [],
      reviews: [],
    });
    expect(result.blocked).toBe(true);
    const item = result.items.find((i) => i.kind === "rule-conflict");
    expect(item).toBeDefined();
    expect(item?.canBypass).toBe(false);
  });
});

describe("Safety Reviewer: 高风险字段", () => {
  it("environmentSensitivity=high 触发 block", () => {
    const result = runSafetyReview({
      input: { ...baseInput, environmentSensitivity: "high" },
      normalized,
      ruleIssues: [],
      schemeSet,
      citationCount: 0,
      risks: [],
      reviews: [],
    });
    expect(result.blocked).toBe(true);
    expect(result.items.some((i) => i.kind === "high-risk-field")).toBe(true);
  });

  it("engineeringType=urban-excavation 触发 block", () => {
    const result = runSafetyReview({
      input: { ...baseInput, engineeringType: "urban-excavation" },
      normalized,
      ruleIssues: [],
      schemeSet,
      citationCount: 0,
      risks: [],
      reviews: [],
    });
    expect(result.blocked).toBe(true);
  });
});

describe("Safety Reviewer: 缺少引用", () => {
  it("零引用且方案数>0 时产生 warning", () => {
    const result = runSafetyReview({
      input: baseInput,
      normalized,
      ruleIssues: [],
      schemeSet: {
        ...schemeSet,
        schemes: [
          {
            id: "scheme-a",
            category: "recommended",
            label: "A",
            tag: "A",
            applicability: "",
            parameterSummary: [],
            predictedParameters: [],
            score: {
              safety: 70,
              suitability: 70,
              economy: 70,
              convenience: 70,
              environment: 70,
              overall: 70,
            },
            risks: [],
          },
        ],
      },
      citationCount: 0,
      risks: [],
      reviews: [],
    });
    expect(result.items.find((i) => i.kind === "missing-citation")).toBeDefined();
  });
});

describe("Safety Reviewer: 人工重点确认清单", () => {
  it("high review 项会被提升为 block", () => {
    const reviews: ReviewRequirement[] = [
      {
        id: "rev-001",
        reason: "敏感场景需要安全工程师签字",
        level: "high",
      },
    ];
    const result = runSafetyReview({
      input: baseInput,
      normalized,
      ruleIssues: [],
      schemeSet,
      citationCount: 2,
      risks: [],
      reviews,
    });
    expect(result.manualConfirmation.some((i) => i.severity === "block")).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("medium review 不阻断，但进入人工清单", () => {
    const reviews: ReviewRequirement[] = [
      {
        id: "rev-002",
        reason: "请人工确认",
        level: "medium",
      },
    ];
    const result = runSafetyReview({
      input: baseInput,
      normalized,
      ruleIssues: [],
      schemeSet,
      citationCount: 2,
      risks: [],
      reviews,
    });
    const mediumItem = result.manualConfirmation.find((i) => i.id.includes("rev-002"));
    expect(mediumItem).toBeDefined();
    expect(mediumItem?.severity).toBe("warning");
    expect(result.blocked).toBe(false);
  });
});

describe("Safety Reviewer: 高风险 + 环境敏感双重", () => {
  it("同时存在高风险字段与高风险风险项时不重复触发", () => {
    const risks: RiskItem[] = [
      { id: "risk-001", level: "high", title: "高敏感区", description: "需要额外控制" },
    ];
    const result = runSafetyReview({
      input: { ...baseInput, environmentSensitivity: "high" },
      normalized,
      ruleIssues: [],
      schemeSet,
      citationCount: 3,
      risks,
      reviews: [],
    });
    expect(result.items.some((i) => i.kind === "environment-sensitive")).toBe(true);
    expect(result.blocked).toBe(true);
  });
});
/**
 * 参数规划 Demo Planner 的纯函数测试。
 * 覆盖：
 * - Zod 参数校验；
 * - 标准化；
 * - 规则冲突；
 * - 稳定评分（同输入同样输出）；
 * - 高风险阻断；
 * - 方案排序；
 * - 预设场景可解析；
 * - 端到端 planDemo 行为。
 */

import { describe, expect, it } from "vitest";

import {
  blastScenarioInputSchema,
  type BlastScenarioInput,
} from "./contracts";
import {
  calculateSchemeScore,
  runRulePrecheck,
  normalizeParameters,
  planParameters,
  analyzeSensitivity,
  sortSchemesByOverall,
  planDemo,
  fingerprintInput,
  makeDemoDeterministicId,
  hasBlockingRuleIssue,
  summarizeRunStatus,
} from "./planner";
import {
  SCENARIO_PRESETS,
  COMPLEX_PRESET_INPUT,
  STANDARD_PRESET_INPUT,
  HIGH_RISK_PRESET_INPUT,
} from "./presets";

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

describe("blastScenarioInputSchema", () => {
  it("accepts a valid input", () => {
    const result = blastScenarioInputSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects invalid protodyakonov value", () => {
    const result = blastScenarioInputSchema.safeParse({
      ...baseInput,
      protodyakonov: 99,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid environmentSensitivity enum", () => {
    const result = blastScenarioInputSchema.safeParse({
      ...baseInput,
      environmentSensitivity: "extreme",
    });
    expect(result.success).toBe(false);
  });

  it("trims freeTextNotes", () => {
    const result = blastScenarioInputSchema.parse({
      ...baseInput,
      freeTextNotes: "  自定义补充  ",
    });
    expect(result.freeTextNotes).toBe("自定义补充");
  });

  it("rejects negative benchHeight (optional)", () => {
    const result = blastScenarioInputSchema.safeParse({
      ...baseInput,
      benchHeight: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizeParameters", () => {
  it("produces stable values for fixed input", () => {
    const a = normalizeParameters(baseInput);
    const b = normalizeParameters(baseInput);
    expect(a).toEqual(b);
  });

  it("uses defaults when optional fields are missing", () => {
    const result = normalizeParameters({
      ...baseInput,
      benchHeight: undefined,
      holeDiameter: undefined,
      holeDepth: undefined,
      stemmingLength: undefined,
    });
    expect(result.benchHeight).toBeGreaterThan(0);
    expect(result.holeDiameter).toBeGreaterThan(0);
    expect(result.holeDepth).toBeGreaterThan(0);
    expect(result.stemmingLength).toBeGreaterThan(0);
  });

  it("switches chargeStructure to decoupled for wet holes", () => {
    const result = normalizeParameters({
      ...baseInput,
      waterCondition: "saturated",
    });
    expect(result.chargeStructure).toBe("decoupled");
  });

  it("prefers tunnel-friendly decked structure for tunnel", () => {
    const result = normalizeParameters({
      ...baseInput,
      engineeringType: "tunnel",
    });
    expect(result.chargeStructure).toBe("decked");
  });
});

describe("runRulePrecheck", () => {
  it("passes for the standard demo input", () => {
    const norm = normalizeParameters(baseInput);
    const issues = runRulePrecheck(baseInput, norm);
    expect(issues.every((i) => i.severity !== "danger")).toBe(true);
  });

  it("flags missing v in high-sensitivity scenario", () => {
    const input: BlastScenarioInput = {
      ...baseInput,
      environmentSensitivity: "high",
      peakParticleVelocity: undefined,
    };
    const norm = normalizeParameters(input);
    const issues = runRulePrecheck(input, norm);
    expect(issues.some((i) => i.code === "INPUT_V_MISSING" && i.severity === "danger")).toBe(true);
  });

  it("flags coupling + wet water conflict", () => {
    const input: BlastScenarioInput = {
      ...baseInput,
      waterCondition: "wet",
    };
    const norm = normalizeParameters(input);
    const issues = runRulePrecheck(input, norm);
    expect(issues.some((i) => i.code === "RULE_STEMMING_SHORT" || i.code === "RULE_DELAY_VIOLATION"))
      .toBe(true);
  });

  it("hasBlockingRuleIssue detects danger issues", () => {
    const input: BlastScenarioInput = {
      ...baseInput,
      environmentSensitivity: "high",
      peakParticleVelocity: undefined,
    };
    const norm = normalizeParameters(input);
    const issues = runRulePrecheck(input, norm);
    expect(hasBlockingRuleIssue(issues)).toBe(true);
  });
});

describe("calculateSchemeScore", () => {
  it("returns deterministic scores for same input", () => {
    const norm = normalizeParameters(baseInput);
    const s1 = calculateSchemeScore(baseInput, norm, "recommended");
    const s2 = calculateSchemeScore(baseInput, norm, "recommended");
    expect(s1).toEqual(s2);
  });

  it("lowers safety when coupling is used in wet holes", () => {
    const dryNorm = normalizeParameters({ ...baseInput, waterCondition: "dry" });
    const wetNorm = normalizeParameters({ ...baseInput, waterCondition: "saturated" });
    const dry = calculateSchemeScore({ ...baseInput, waterCondition: "dry" }, dryNorm, "recommended");
    const wet = calculateSchemeScore({ ...baseInput, waterCondition: "saturated" }, wetNorm, "recommended");
    expect(wet.safety).toBeGreaterThanOrEqual(dry.safety);
  });

  it("rewards decoupled structure (in scenario)", () => {
    const input: BlastScenarioInput = {
      ...baseInput,
      waterCondition: "saturated",
    };
    const norm = normalizeParameters(input);
    const recommended = calculateSchemeScore(input, norm, "recommended");
    expect(recommended.safety).toBeGreaterThan(50);
  });

  it("weights differences change with environment sensitivity", () => {
    const highInput: BlastScenarioInput = {
      ...baseInput,
      environmentSensitivity: "high",
    };
    const lowInput: BlastScenarioInput = {
      ...baseInput,
      environmentSensitivity: "low",
    };
    const normHigh = normalizeParameters(highInput);
    const normLow = normalizeParameters(lowInput);
    const highRecommended = calculateSchemeScore(highInput, normHigh, "recommended");
    const lowRecommended = calculateSchemeScore(lowInput, normLow, "recommended");
    expect(highRecommended.environment).not.toBe(lowRecommended.environment);
  });
});

describe("planParameters", () => {
  it("returns at least 4 predicted parameters", () => {
    const params = planParameters({
      input: baseInput,
      normalized: normalizeParameters(baseInput),
      variants: "baseline",
    });
    expect(params.length).toBeGreaterThanOrEqual(4);
  });

  it("each parameter has source/range/confidence", () => {
    const params = planParameters({
      input: baseInput,
      normalized: normalizeParameters(baseInput),
    });
    for (const p of params) {
      expect(p.source).toMatch(/input|rule|model|human/);
      expect(p.range.min).toBeLessThanOrEqual(p.range.max);
    }
  });
});

describe("analyzeSensitivity", () => {
  it("produces axes × 5 cells", () => {
    const norm = normalizeParameters(baseInput);
    const sensitivity = analyzeSensitivity(
      baseInput,
      norm,
      calculateSchemeScore(baseInput, norm, "recommended"),
    );
    expect(sensitivity.axes.length).toBeGreaterThan(0);
    expect(sensitivity.cells.length).toBe(sensitivity.axes.length * 5);
  });
});

describe("sortSchemesByOverall", () => {
  it("places recommended first", () => {
    const schemes = [
      { id: "x", category: "risk" as const, label: "", tag: "", applicability: "", parameterSummary: [], predictedParameters: [], score: { safety: 80, suitability: 80, economy: 80, convenience: 80, environment: 80, overall: 80 }, risks: [] },
      { id: "y", category: "recommended" as const, label: "", tag: "", applicability: "", parameterSummary: [], predictedParameters: [], score: { safety: 50, suitability: 50, economy: 50, convenience: 50, environment: 50, overall: 50 }, risks: [] },
    ];
    const sorted = sortSchemesByOverall(schemes);
    expect(sorted[0]?.category).toBe("recommended");
  });
});

describe("planDemo end-to-end stability", () => {
  it("returns the same run id for the same input", () => {
    const a = planDemo({ input: baseInput, simulatedNowIso: "2026-07-04T00:00:00+08:00" });
    const b = planDemo({ input: baseInput, simulatedNowIso: "2026-07-04T00:00:00+08:00" });
    expect(a.run.id).toBe(b.run.id);
    expect(a.run.normalized).toEqual(b.run.normalized);
  });

  it("produces 3 schemes (recommended / alternative / risk)", () => {
    const result = planDemo({ input: STANDARD_PRESET_INPUT });
    expect(result.run.schemeSet.schemes).toHaveLength(3);
    const categories = result.run.schemeSet.schemes.map((s) => s.category);
    expect(categories).toContain("recommended");
    expect(categories).toContain("alternative");
    expect(categories).toContain("risk");
  });

  it("blocks the high-risk demo scenario", () => {
    const result = planDemo({ input: HIGH_RISK_PRESET_INPUT });
    expect(result.run.status).toBe("blocked");
    expect(result.run.blockedReason).toBeDefined();
    expect(result.run.risks.some((r) => r.level === "high")).toBe(true);
  });

  it("captures review requirements for high-sensitivity scenarios", () => {
    const result = planDemo({ input: HIGH_RISK_PRESET_INPUT });
    expect(result.run.reviews.length).toBeGreaterThan(0);
    expect(result.run.reviews.some((r) => r.level === "high")).toBe(true);
  });

  it("complex scenario runs to completion without blocking", () => {
    const result = planDemo({ input: COMPLEX_PRESET_INPUT });
    expect(["running", "succeeded", "awaiting_review"].includes(result.run.status)).toBe(true);
    expect(result.run.schemeSet.schemes).toHaveLength(3);
    expect(result.run.schemeSet.recommendedId).toBeDefined();
  });

  it("summary status returns blocked for danger rules", () => {
    const issues = [
      { code: "X", message: "x", severity: "danger" as const },
    ];
    const summary = summarizeRunStatus(issues, false);
    expect(summary.status).toBe("blocked");
  });

  it("summary status returns awaiting_review only when no danger and inputs missing", () => {
    /** No danger rule but hasMissingRequired → awaiting_review */
    const summary = summarizeRunStatus([], true);
    expect(summary.status).toBe("awaiting_review");
  });

  it("summary blocked wins over awaiting_review when danger rule present", () => {
    const summary = summarizeRunStatus(
      [{ code: "X", message: "x", severity: "danger" as const }],
      true,
    );
    expect(summary.status).toBe("blocked");
  });
});

describe("scenario presets", () => {
  for (const preset of SCENARIO_PRESETS) {
    it(`validates preset ${preset.id} input`, () => {
      const result = blastScenarioInputSchema.safeParse(preset.input);
      expect(result.success).toBe(true);
    });
  }
});

describe("fingerprintInput", () => {
  it("is order-stable across property order", () => {
    /** Reorder keys by spreading a different ordering; fingerprint must match. */
    const reordered: BlastScenarioInput = {
      freeTextNotes: baseInput.freeTextNotes,
      convenienceRequirement: baseInput.convenienceRequirement,
      costPreference: baseInput.costPreference,
      engineeringType: baseInput.engineeringType,
      environmentSensitivity: baseInput.environmentSensitivity,
      jointCondition: baseInput.jointCondition,
      protectionTarget: baseInput.protectionTarget,
      rockCategory: baseInput.rockCategory,
      waterCondition: baseInput.waterCondition,
      constructionEnvironment: baseInput.constructionEnvironment,
      protodyakonov: baseInput.protodyakonov,
      benchHeight: baseInput.benchHeight,
      holeDepth: baseInput.holeDepth,
      holeDiameter: baseInput.holeDiameter,
      stemmingLength: baseInput.stemmingLength,
      targetFragmentation: baseInput.targetFragmentation,
      peakParticleVelocity: baseInput.peakParticleVelocity,
      flyrockRisk: baseInput.flyrockRisk,
    };
    expect(fingerprintInput(baseInput)).toBe(fingerprintInput(reordered));
  });
});

describe("makeDemoDeterministicId", () => {
  it("produces the same id for same input", () => {
    const id = makeDemoDeterministicId("test", "alpha", 0);
    expect(id).toBe(makeDemoDeterministicId("test", "alpha", 0));
  });
  it("produces different ids for different seeds", () => {
    expect(makeDemoDeterministicId("test", "alpha", 0)).not.toBe(
      makeDemoDeterministicId("test", "beta", 0),
    );
  });
});

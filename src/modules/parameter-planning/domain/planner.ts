/**
 * 爆破参数预测与方案规划 - Demo 规划引擎（确定性纯函数）。
 *
 * 严禁：
 * - 引用 React、DOM、网络
 * - 引入随机数 / 时间相关行为（除 ID 生成）
 * - 调用 DeepSeek SDK 或任何外部副作用
 *
 * 允许：
 * - 访问纯常量
 * - 产生确定的、可重放的方案与评分（同输入始终得到同输出）
 */

import {
  type BlastScenarioInput,
  type NormalizedParameterSet,
  type PredictedParameter,
  type ReviewRequirement,
  type RiskItem,
  type RuleCheckIssue,
  type SensitivityCell,
  type SensitivityMatrix,
  type Scheme,
  type SchemeCategory,
  type SchemeScore,
  type SchemeSet,
  type PlanningStepEvent,
  type PlanningStepStatus,
  type PlanningStepId,
  type PlanningRunStatus,
} from "./contracts";
import {
  defaultBenchHeight,
  defaultHoleDiameter,
  defaultStemmingLength,
  describeRockByF,
} from "./constants";

/* ----------- ID 生成 ----------- */

/**
 * Demo ID 生成：可重放 + 可读。基于输入 hash + 步骤序号。
 * 生产环境由 DAG 调度器或数据库提供。
 */
export function makeDemoDeterministicId(prefix: string, seed: string, index: number): string {
  const hash = simpleStringHash(`${prefix}|${seed}|${index}`);
  return `${prefix}-${hash.toString(36).slice(0, 8)}`;
}

function simpleStringHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/* ----------- 输入原值指纹 ----------- */

/**
 * 用作 Run 内部 seed：值按字段排序拼接，
 * 保证同样输入得到同样 hash，同样工作流产生。
 */
export function fingerprintInput(input: BlastScenarioInput): string {
  const sortedKeys = Object.keys(input).sort();
  return sortedKeys.map((k) => `${k}=${String((input as Record<string, unknown>)[k])}`).join(";");
}

/* ----------- Step 1: 参数标准化 ----------- */

export interface NormalizationOptions {
  /** 当输入缺省台阶高度时，是否采用默认 */
  fillDefaults?: boolean;
}

/**
 * 将原始输入归一化为统一参数集合。
 *
 * 规则：
 * - 工程类型 → 默认孔径、台阶高、堵塞长度；
 * - 普氏系数 f → 单位装药、孔距、孔距系数；
 * - 含水 → 装药结构（耦合 vs 不耦合）；
 * - 节理 → 孔距系数微调；
 * - 安全距离保护对象 → 默认允许振速。
 *
 * 所有数值均为模拟值，仅供 Demo 展示。
 */
export function normalizeParameters(
  input: BlastScenarioInput,
  options: NormalizationOptions = {},
): NormalizedParameterSet {
  const f = input.protodyakonov;
  const fill = options.fillDefaults ?? true;

  const benchHeight =
    input.benchHeight ?? (fill ? defaultBenchHeight(input.engineeringType) : 6);
  const holeDiameter = input.holeDiameter ?? (fill ? defaultHoleDiameter(input.engineeringType) : 100);
  const stemmingLength =
    input.stemmingLength ?? (fill ? defaultStemmingLength(input.engineeringType) : 2);
  const holeDepth = input.holeDepth ?? Math.round(benchHeight * 1.05 * 10) / 10;

  /** 阻抗匹配：装药集中度（kg/m）经验公式：
   * q = 0.45 * sqrt(f) * (d/100)^2 * k
   *   - f 普氏系数，d 孔径(mm)，k 系数(1.0~1.25)
   */
  const baseLinear = 0.45 * Math.sqrt(f) * Math.pow(holeDiameter / 100, 2);
  const stiffness = describeRockByF(f).stiffness;
  const waterBoost =
    input.waterCondition === "saturated" ? 1.15 :
    input.waterCondition === "wet" ? 1.08 :
    input.waterCondition === "damp" ? 1.0 : 0.95;
  const linearChargeDensity = Number((baseLinear * (0.9 + stiffness * 0.3) * waterBoost).toFixed(2));

  /** 最小抵抗线（m）：w ≈ 0.45 * d * sqrt(pi * rho_e / rho_r / q) 简化
   *  这里给确定性经验值：
   */
  const burdenDistance =
    input.engineeringType === "tunnel"
      ? 0.6
      : Number(Math.max(1.5, Math.min(8, holeDiameter / 30 + f / 6)).toFixed(2));

  /** 孔距 a（m）：a = k * w（k ≈ 1.0~1.4） */
  const jointFactor =
    input.jointCondition === "massive" ? 1.05 :
    input.jointCondition === "blocky" ? 1.15 :
    input.jointCondition === "fractured" ? 1.25 :
    input.jointCondition === "highly-fractured" ? 1.35 : 1.4;
  const holeSpacing = Number((burdenDistance * jointFactor).toFixed(2));

  /** 排距 b（m）：b = 0.85 a 简化 */
  const rowSpacing = Number((holeSpacing * 0.85).toFixed(2));

  /** 装药结构：耦合、间隔、不耦合 */
  const chargeStructure: NormalizedParameterSet["chargeStructure"] =
    input.waterCondition === "saturated" || input.waterCondition === "wet"
      ? "decoupled"
      : input.engineeringType === "tunnel"
        ? "decked"
        : "coupled";

  /** 总装药量：根据台阶高度与孔排距估算一个炮孔的装药，再 *6 模拟多孔 */
  const chargePerHole = linearChargeDensity * (holeDepth - stemmingLength);
  const totalChargeKg = Number((chargePerHole * 6).toFixed(1));

  /** 最大单响药量：根据保护对象与允许振速折算。Demo 公式：mg = ρ*V/(k) */
  const peakParticleVelocity =
    input.peakParticleVelocity ??
    defaultPeakParticleVelocity(input.protectionTarget, input.environmentSensitivity);
  /** 估算最大单响 (kg)：典型控制在 mg ≈ 30~80kg，这里给确定性近似 */
  const maxChargePerDelay =
    Math.round(
      Math.max(
        5,
        Math.min(
          120,
          18 * Math.pow(peakParticleVelocity, 1.4) *
            (input.engineeringType === "tunnel" ? 0.5 : 1) *
            (input.environmentSensitivity === "high" ? 0.7 : input.environmentSensitivity === "low" ? 1.1 : 1),
        ),
      ),
    );

  const holeCountPerRound =
    input.engineeringType === "tunnel" ? 1 :
    input.engineeringType === "demolition" ? 8 :
    input.engineeringType === "urban-excavation" ? 6 : 12;
  void holeCountPerRound; // 暂未直接使用：保留作扩展

  return {
    engineeringTypeLabel: ENGINEERING_TYPE_LABEL_VALUE(input.engineeringType),
    rockCategoryLabel: ROCK_CATEGORY_LABEL_VALUE(input.rockCategory),
    protodyakonov: f,
    benchHeight,
    holeDiameter,
    holeDepth,
    stemmingLength,
    holeSpacing,
    rowSpacing,
    burdenDistance,
    chargeStructure,
    linearChargeDensity,
    maxChargePerDelay,
    totalChargeKg,
    peakParticleVelocity,
  };

  function ENGINEERING_TYPE_LABEL_VALUE(t: BlastScenarioInput["engineeringType"]): string {
    return ({
      "open-pit-bench": "露天深孔台阶",
      tunnel: "隧道掘进",
      "underground-cavern": "地下硐室",
      "urban-excavation": "城市基坑",
      demolition: "拆除爆破",
    })[t];
  }
  function ROCK_CATEGORY_LABEL_VALUE(r: BlastScenarioInput["rockCategory"]): string {
    return ({
      soft: "软岩",
      "medium-soft": "中软岩",
      medium: "中硬岩",
      "medium-hard": "中硬偏硬岩",
      hard: "硬岩",
      "very-hard": "坚硬岩",
    })[r];
  }
}

export function defaultPeakParticleVelocity(
  protection: BlastScenarioInput["protectionTarget"],
  sensitivity: BlastScenarioInput["environmentSensitivity"],
): number {
  /** 默认振速（cm/s），与保护对象 + 环境敏感度组合 */
  let base: number;
  if (protection === "none") base = 5.0;
  else if (protection === "heritage" || protection === "hospital") base = 1.0;
  else if (protection === "school") base = 1.5;
  else if (protection === "residential") base = 2.0;
  else if (protection === "utility") base = 1.2;
  else base = 1.5; // wildlife

  if (sensitivity === "high") base *= 0.7;
  else if (sensitivity === "low") base *= 1.4;

  return Number(base.toFixed(2));
}

/* ----------- Step 2: 规则预检查 ----------- */

export function runRulePrecheck(
  input: BlastScenarioInput,
  normalized: NormalizedParameterSet,
): RuleCheckIssue[] {
  const issues: RuleCheckIssue[] = [];

  /** 1. 必填项守卫：peakParticleVelocity 在高敏感场景下必填 */
  if (input.environmentSensitivity === "high" && !input.peakParticleVelocity) {
    issues.push({
      code: "INPUT_V_MISSING",
      severity: "danger",
      message: "高敏感场景未提供允许振速（v）参数",
      paramKey: "peakParticleVelocity",
      advice: "请补充年允许峰值振速（cm/s）或选择中等敏感度。",
    });
  }

  /** 2. 孔径与台阶不匹配：超大型孔径配小台阶，浪费 */
  if (normalized.holeDiameter >= 200 && normalized.benchHeight < 8) {
    issues.push({
      code: "RULE_DIAMETER_BENCH",
      severity: "warning",
      message: "孔径偏大但台阶高度偏小，建议减小孔径或加大台阶",
      paramKey: "holeDiameter",
    });
  }

  /** 3. 堵塞长度过短：易产生飞石 */
  if (
    normalized.stemmingLength < 0.7 * normalized.holeDiameter / 100 * 5 &&
    input.constructionEnvironment !== "confined"
  ) {
    issues.push({
      code: "RULE_STEMMING_SHORT",
      severity: "warning",
      message: "堵塞长度偏短，可能增加飞石风险",
      paramKey: "stemmingLength",
      advice: "建议增加堵塞长度至 ≥ 1.2 倍抵抗线。",
    });
  }

  /** 4. 装药结构与水耦合冲突 */
  if (
    (input.waterCondition === "wet" || input.waterCondition === "saturated") &&
    normalized.chargeStructure === "coupled"
  ) {
    issues.push({
      code: "RULE_CHARGE_STRUCTURE",
      severity: "warning",
      message: "炮孔含水但仍采用耦合装药，建议改为不耦合或间隔装药",
      paramKey: "chargeStructure",
    });
  }

  /** 5. 单响药量 vs 允许振速 */
  if (
    input.peakParticleVelocity &&
    normalized.maxChargePerDelay > 60 &&
    input.environmentSensitivity === "high"
  ) {
    issues.push({
      code: "RULE_DELAY_VIOLATION",
      severity: "danger",
      message: "高敏感环境 + 单响药量偏高，建议减小单段药量或增加分段",
      paramKey: "maxChargePerDelay",
    });
  }

  /** 6. 居民区 + 飞石风险 */
  if (
    (input.protectionTarget === "residential" || input.protectionTarget === "school") &&
    input.flyrockRisk === "high"
  ) {
    issues.push({
      code: "RULE_FLYROCK_RESIDENTIAL",
      severity: "danger",
      message: "居民/学校附近评估为高飞石风险，必须人工降级方案或增加覆盖",
      paramKey: "flyrockRisk",
    });
  }

  /** 7. 经济性与安全冲突 */
  if (
    input.costPreference === "strict" &&
    (input.protectionTarget === "hospital" || input.protectionTarget === "heritage") &&
    input.environmentSensitivity !== "low"
  ) {
    issues.push({
      code: "RULE_COST_SAFETY_CONFLICT",
      severity: "warning",
      message: "成本倾向严格且周边为高敏感对象，建议优先选择安全加权更高方案",
      paramKey: "costPreference",
    });
  }

  /** 8. 节理裂隙 vs 孔网：节理发育时孔距系数应放大 */
  if (
    (input.jointCondition === "fractured" || input.jointCondition === "highly-fractured") &&
    normalized.holeSpacing < normalized.burdenDistance * 1.1
  ) {
    issues.push({
      code: "RULE_JOINT_SPACING",
      severity: "info",
      message: "节理发育岩体建议孔距系数 ≥ 1.1（Demo 提示）",
      paramKey: "holeSpacing",
    });
  }

  /** 9. 总装药量超 1000kg Demo 提示（不是现场限制，仅为演示） */
  if (normalized.totalChargeKg > 1000) {
    issues.push({
      code: "RULE_TOTAL_DEMO_HINT",
      severity: "info",
      message: "Demo 总装药量超过 1000 kg，仅为模拟数值，请勿用于现场控制",
    });
  }

  return issues;
}

/** 规则 issues 中是否包含阻断级（danger） */
export function hasBlockingRuleIssue(issues: readonly RuleCheckIssue[]): boolean {
  return issues.some((i) => i.severity === "danger");
}

/* ----------- Step 3: 参数预测（Deterministic） ----------- */

export interface PredictedParameterInput {
  input: BlastScenarioInput;
  normalized: NormalizedParameterSet;
  variants?: "conservative" | "baseline" | "aggressive";
}

/**
 * 给定归一化结果，按方案风格（保守 / 基准 / 激进）产出 PredictedParameter 列表。
 * 当前阶段所有预测均为确定性模拟，不调用模型。
 */
export function planParameters(
  ctx: PredictedParameterInput,
): readonly PredictedParameter[] {
  const { normalized, input } = ctx;
  const variant = ctx.variants ?? "baseline";

  const multiplier =
    variant === "conservative" ? 1.1 :
    variant === "aggressive" ? 0.9 : 1.0;

  const adjustment =
    variant === "conservative" ? -1 :
    variant === "aggressive" ? 1 : 0;

  const predicted: PredictedParameter[] = [];

  /** 装药集中度 */
  predicted.push({
    key: "linearChargeDensity",
    label: "装药集中度 q",
    value: Number((normalized.linearChargeDensity * multiplier).toFixed(2)),
    unit: "kg/m",
    range: {
      min: Number((normalized.linearChargeDensity * 0.85).toFixed(2)),
      max: Number((normalized.linearChargeDensity * 1.2).toFixed(2)),
    },
    source: variant === "baseline" ? "rule" : "model",
    sourceKind: variant === "baseline" ? "rule" : "model-placeholder",
    confidenceLevel: variant === "aggressive" ? "low" : "medium",
    rationale:
      variant === "conservative"
        ? "降低装药集中度以缓冲振动与飞石；建议增加分段。"
        : variant === "aggressive"
          ? "提升装药集中度减少孔数，但需复核单段药量。"
          : "由归一化规则推导；与历史规范区间一致。",
    requiresReview: variant !== "baseline",
  });

  /** 孔距 */
  predicted.push({
    key: "holeSpacing",
    label: "孔距 a",
    value: Number((normalized.holeSpacing * multiplier).toFixed(2)),
    unit: "m",
    range: {
      min: Number((normalized.holeSpacing * 0.85).toFixed(2)),
      max: Number((normalized.holeSpacing * 1.15).toFixed(2)),
    },
    source: "rule",
    sourceKind: "rule",
    confidenceLevel: "high",
    rationale:
      variant === "conservative"
        ? "减小孔距增强破碎均匀度。"
        : variant === "aggressive"
          ? "放大孔距提高单孔负担。"
          : "按抵抗线 × 节理系数（1.0~1.4）推导。",
    requiresReview: false,
  });

  /** 最大单响 */
  predicted.push({
    key: "maxChargePerDelay",
    label: "最大单响药量 Q",
    value: Number(Math.max(5, normalized.maxChargePerDelay + adjustment * 8)),
    unit: "kg",
    range: {
      min: Math.max(5, normalized.maxChargePerDelay - 12),
      max: normalized.maxChargePerDelay + 18,
    },
    source: variant === "baseline" ? "rule" : "model",
    sourceKind: variant === "baseline" ? "rule" : "model-placeholder",
    confidenceLevel: variant === "baseline" ? "high" : "medium",
    rationale:
      "根据保护对象允许振速与场地距离近似推算；具体值需结合试爆校核。",
    requiresReview: input.environmentSensitivity === "high",
  });

  /** 堵塞长度 */
  predicted.push({
    key: "stemmingLength",
    label: "堵塞长度 L",
    value: Number((normalized.stemmingLength * (variant === "aggressive" ? 0.95 : 1)).toFixed(2)),
    unit: "m",
    range: {
      min: Number((normalized.stemmingLength * 0.85).toFixed(2)),
      max: Number((normalized.stemmingLength * 1.2).toFixed(2)),
    },
    source: "rule",
    sourceKind: "rule",
    confidenceLevel: "medium",
    rationale:
      input.waterCondition === "wet" || input.waterCondition === "saturated"
        ? "含水场景适度延长堵塞以减少冲孔风险。"
        : "依据孔径与抵抗线比例推导。",
    requiresReview: false,
  });

  return predicted;
}

/* ----------- Step 4: 评分 ----------- */

export interface ScoreWeights {
  safety: number;
  suitability: number;
  economy: number;
  convenience: number;
  environment: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  safety: 0.4,
  suitability: 0.2,
  economy: 0.15,
  convenience: 0.15,
  environment: 0.1,
};

/** 根据输入微调权重：环境敏感时更看重 safety + environment；成本严格时 economy 提升 */
export function resolveScoreWeights(input: BlastScenarioInput): ScoreWeights {
  const w: ScoreWeights = { ...DEFAULT_SCORE_WEIGHTS };
  if (input.environmentSensitivity === "high") {
    w.safety += 0.1;
    w.environment += 0.05;
    w.economy -= 0.1;
    w.convenience -= 0.05;
  } else if (input.environmentSensitivity === "low") {
    w.economy += 0.05;
    w.convenience += 0.05;
    w.safety -= 0.05;
    w.environment -= 0.05;
  }
  if (input.costPreference === "strict") {
    w.economy += 0.05;
    w.safety -= 0.05;
  } else if (input.costPreference === "premium") {
    w.safety += 0.05;
    w.economy -= 0.05;
  }
  return w;
}

/** 输入 + 预测 → 多维评分（deterministic，0-100） */
export function calculateSchemeScore(
  input: BlastScenarioInput,
  normalized: NormalizedParameterSet,
  schemeTag: SchemeCategory,
): SchemeScore {
  const weights = resolveScoreWeights(input);

  /** safety：装药结构与振速配合越好分数越高；
   *  - 含水时 decoupled 高分，coupled 低分；
   *  - 最大单响 在允许振速内的相对位置；
   *  - 飞石风险越高，扣分越多。
   */
  const safetyBase = 75;
  const safetyChargeBonus =
    normalized.chargeStructure === ("decoupled" as NormalizedParameterSet["chargeStructure"]) &&
    (input.waterCondition === "wet" || input.waterCondition === "saturated")
      ? 12
      : normalized.chargeStructure === ("coupled" as NormalizedParameterSet["chargeStructure"]) &&
          (input.waterCondition === "wet" || input.waterCondition === "saturated")
        ? -8
        : 0;
  const safetyDelayPenalty =
    normalized.maxChargePerDelay > 60 && input.environmentSensitivity === "high"
      ? -12
      : normalized.maxChargePerDelay > 100 && input.environmentSensitivity !== "low"
        ? -6
        : 0;
  const safetyFlyrockPenalty =
    input.flyrockRisk === "high"
      ? -8
      : input.flyrockRisk === "medium"
        ? -3
        : 0;

  /** suitability：方案风格与工程条件的契合度 */
  const suitabilityBonus =
    schemeTag === "recommended" ? 6 : schemeTag === "alternative" ? 0 : -8;
  const suitabilityEnvironmentBonus =
    input.engineeringType === "tunnel" && normalized.chargeStructure === "decked"
      ? 4
      : 0;

  /** economy：装药总量越少（仍满足条件）分数越高。线性映射 */
  const economyBase = 70;
  const economyTotalChargePenalty = Math.min(30, normalized.totalChargeKg / 50);
  const economyReward =
    schemeTag === "alternative" && input.costPreference !== "premium" ? 5 : 0;

  /** convenience：方案越常规、施工工序越少分数越高 */
  const convenienceBase =
    schemeTag === "alternative" ? 60 : schemeTag === "recommended" ? 78 : 50;
  const convenienceRequirementBonus =
    input.convenienceRequirement === "high" && schemeTag === "recommended"
      ? 6
      : input.convenienceRequirement === "low" && schemeTag === "risk"
        ? 6
        : 0;

  /** environment：环境影响（飞石 + 振动 + 噪声） */
  const environmentBase = 70;
  const environmentSensitivityPenalty =
    input.environmentSensitivity === "high"
      ? -6
      : input.environmentSensitivity === "low"
        ? 6
        : 0;
  const environmentWaterPenalty =
    input.waterCondition === "saturated" && schemeTag !== "recommended" ? -6 : 0;

  /** clamp 到 5..100 区间，避免极端 */
  const clamp = (v: number): number => Math.max(5, Math.min(100, Math.round(v)));

  const safety = clamp(
    safetyBase + safetyChargeBonus + safetyDelayPenalty + safetyFlyrockPenalty,
  );
  const suitability = clamp(72 + suitabilityBonus + suitabilityEnvironmentBonus);
  const economy = clamp(economyBase - economyTotalChargePenalty + economyReward);
  const convenience = clamp(convenienceBase + convenienceRequirementBonus);
  const environment = clamp(
    environmentBase + environmentSensitivityPenalty + environmentWaterPenalty,
  );

  const overall = Math.round(
    safety * weights.safety +
      suitability * weights.suitability +
      economy * weights.economy +
      convenience * weights.convenience +
      environment * weights.environment,
  );

  return {
    safety: clampSafety(safety),
    suitability,
    economy,
    convenience,
    environment,
    overall: Math.max(5, Math.min(100, overall)),
  };
}

function clampSafety(v: number): number {
  return Math.max(5, Math.min(100, Math.round(v)));
}

/* ----------- Step 5: 方案生成 ----------- */

const SCHEME_TEMPLATES: Array<{
  category: SchemeCategory;
  tag: string;
  label: string;
  applicability: string;
  note?: string;
  multiplier: number; // 对归一化装药集中度 / 单响的调整
}> = [
  {
    category: "recommended",
    tag: "推荐方案",
    label: "标准 · 推荐方案",
    applicability: "适合参数完整、规则无冲突的常规场景。",
    multiplier: 1.0,
  },
  {
    category: "alternative",
    tag: "备选方案",
    label: "经济 · 备选方案",
    applicability: "在安全约束内追求成本最低；适合成本优先场景。",
    note: "该方案会减少分段，请复核振速。",
    multiplier: 0.92,
  },
  {
    category: "risk",
    tag: "高风险方案",
    label: "激进 · 不推荐（Demo）",
    applicability: "为对比展示故意放大装药；仅用作 Demo 方案对比。",
    note: "默认不进入人工复核，请在报告里标识为不推荐。",
    multiplier: 1.18,
  },
];

export function generateSchemes(
  input: BlastScenarioInput,
  normalized: NormalizedParameterSet,
  ruleIssues: readonly RuleCheckIssue[],
): SchemeSet {
  const schemes: Scheme[] = SCHEME_TEMPLATES.map((template, idx) => {
    const variants =
      template.category === "recommended"
        ? "baseline"
        : template.category === "alternative"
          ? "aggressive"
          : "aggressive";

    const personalizedNorm: NormalizedParameterSet = {
      ...normalized,
      linearChargeDensity: Number(
        (normalized.linearChargeDensity * template.multiplier).toFixed(2),
      ),
      maxChargePerDelay: Math.max(
        5,
        Math.round(normalized.maxChargePerDelay * template.multiplier),
      ),
    };

    const predicted = planParameters({
      input,
      normalized: personalizedNorm,
      variants,
    });
    const score = calculateSchemeScore(input, personalizedNorm, template.category);

    /** 阻断风险方案如果存在 danger 级别规则，则转换为"不通过"，不进入 recommended */
    if (
      template.category === "recommended" &&
      hasBlockingRuleIssue(ruleIssues)
    ) {
      return {
        ...shapeScheme(template, idx, personalizedNorm, predicted, score, input),
        tag: "推荐方案（被阻断）",
        note: "因规则预检包含 danger 级别问题被 Safety Reviewer 阻断。",
      };
    }

    if (template.category === "risk") {
      return shapeScheme(template, idx, personalizedNorm, predicted, score, input);
    }

    return shapeScheme(template, idx, personalizedNorm, predicted, score, input);
  });

  const recommendedId = schemes.find((s) => s.category === "recommended")?.id ?? "";
  const alternativeIds = schemes
    .filter((s) => s.category === "alternative")
    .map((s) => s.id);
  const riskIds = schemes.filter((s) => s.category === "risk").map((s) => s.id);

  return { schemes, recommendedId, alternativeIds, riskIds };
}

function shapeScheme(
  template: (typeof SCHEME_TEMPLATES)[number],
  idx: number,
  normalized: NormalizedParameterSet,
  predicted: readonly PredictedParameter[],
  score: SchemeScore,
  input: BlastScenarioInput,
): Scheme {
  const id = makeDemoDeterministicId(
    `scheme-${template.category}`,
    `${input.engineeringType}-${input.protodyakonov}`,
    idx,
  );

  return {
    id,
    category: template.category,
    label: template.label,
    tag: template.tag,
    applicability: template.applicability,
    note: template.note,
    predictedParameters: predicted,
    parameterSummary: predicted.map((p) => ({
      key: p.key,
      label: p.label,
      value: p.value,
      unit: p.unit,
    })),
    score,
    risks: deriveSchemeRisks(input, normalized, template.category),
  };
}

function deriveSchemeRisks(
  input: BlastScenarioInput,
  normalized: NormalizedParameterSet,
  category: SchemeCategory,
): string[] {
  const risks: string[] = [];

  if (category === "risk") {
    risks.push("激进装药，单段药量可能超过规范范围（Demo 提示）");
  }
  if (input.flyrockRisk === "high") {
    risks.push("飞石评估偏高，需设置警戒范围并采取覆盖防护");
  }
  if (input.environmentSensitivity === "high") {
    risks.push("高敏感环境，需重点复核振速与噪声影响");
  }
  if (input.waterCondition === "saturated") {
    risks.push("饱水炮孔可能影响起爆可靠性，建议使用抗水炸药");
  }
  if (
    normalized.chargeStructure === "coupled" &&
    (input.waterCondition === "wet" || input.waterCondition === "saturated")
  ) {
    risks.push("耦合装药与含水条件冲突");
  }
  if (normalized.maxChargePerDelay > 80) {
    risks.push("单响药量偏高，需增加分段与延迟时间");
  }
  if (
    input.protectionTarget === "hospital" ||
    input.protectionTarget === "heritage"
  ) {
    risks.push("周边为医院/历史建筑，必须按 v≤1.0 cm/s 控制");
  }

  return risks;
}

/* ----------- Step 6: 风险汇总 ----------- */

export function collectRisks(
  input: BlastScenarioInput,
  ruleIssues: readonly RuleCheckIssue[],
  schemes: readonly Scheme[],
): RiskItem[] {
  const items: RiskItem[] = [];

  /** 规则 → 风险 */
  ruleIssues
    .filter((i) => i.severity !== "info")
    .forEach((issue, idx) => {
      items.push({
        id: makeDemoDeterministicId(
          "risk-rule",
          `${issue.code}`,
          idx,
        ),
        level:
          issue.severity === "danger" ? "high" :
          issue.severity === "warning" ? "medium" : "low",
        title: ruleIssueTitle(issue.code),
        description: issue.message + (issue.advice ? `（${issue.advice}）` : ""),
        paramKey: issue.paramKey,
      });
    });

  /** 方案 → 风险 */
  schemes.forEach((scheme, idx) => {
    scheme.risks.forEach((r) => {
      items.push({
        id: makeDemoDeterministicId(
          "risk-scheme",
          `${scheme.id}-${idx}`,
          items.length,
        ),
        level:
          scheme.category === "risk"
            ? "high"
            : scheme.category === "alternative"
              ? "medium"
              : "low",
        title: `${scheme.tag}：${r}`,
        description: `方案「${scheme.label}」识别风险：${r}`,
        schemeId: scheme.id,
      });
    });
  });

  return items;
}

const RULE_ISSUE_TITLES: Record<string, string> = {
  INPUT_V_MISSING: "缺失关键参数：允许振速 v",
  RULE_DIAMETER_BENCH: "孔径与台阶高度不匹配",
  RULE_STEMMING_SHORT: "堵塞长度偏短",
  RULE_CHARGE_STRUCTURE: "装药结构与含水条件冲突",
  RULE_DELAY_VIOLATION: "单响药量超出允许振速",
  RULE_FLYROCK_RESIDENTIAL: "居民区附近飞石风险",
  RULE_COST_SAFETY_CONFLICT: "成本与安全冲突",
  RULE_JOINT_SPACING: "节理发育岩体孔距建议",
  RULE_TOTAL_DEMO_HINT: "总装药量 Demo 提示",
};

function ruleIssueTitle(code: string): string {
  return RULE_ISSUE_TITLES[code] ?? code;
}

/* ----------- Step 7: 人工复核清单 ----------- */

export function collectReviewRequirements(
  input: BlastScenarioInput,
  ruleIssues: readonly RuleCheckIssue[],
  schemes: readonly Scheme[],
): ReviewRequirement[] {
  const list: ReviewRequirement[] = [];

  ruleIssues
    .filter((i) => i.severity === "danger")
    .forEach((issue, idx) => {
      list.push({
        id: makeDemoDeterministicId("review-rule", issue.code, idx),
        paramKey: issue.paramKey,
        reason: issue.message,
        level: "high",
      });
    });

  if (input.environmentSensitivity === "high") {
    list.push({
      id: makeDemoDeterministicId("review-v", String(input.environmentSensitivity), list.length),
      paramKey: "peakParticleVelocity",
      reason: "高敏感环境必须补充允许振速，并由 Safety Reviewer 复核。",
      level: "high",
    });
  }

  schemes.forEach((scheme, idx) => {
    if (scheme.category === "alternative" && input.costPreference === "strict") {
      list.push({
        id: makeDemoDeterministicId("review-cost", scheme.id, idx),
        schemeId: scheme.id,
        reason: "成本优先备选方案可能与高保护对象冲突，需复核。",
        level: "medium",
      });
    }
    scheme.predictedParameters
      .filter((p) => p.requiresReview)
      .forEach((p) => {
        list.push({
          id: makeDemoDeterministicId(
            "review-param",
            `${scheme.id}-${p.key}`,
            list.length,
          ),
          paramKey: p.key,
          schemeId: scheme.id,
          reason: `${p.label}：${p.rationale}`,
          level: "medium",
        });
      });
  });

  return list;
}

/* ----------- Step 8: 敏感性分析 ----------- */

/**
 * 围绕" +1 百分点 调整后归一化量 " 计算综合评分（overall）的 Δ 评分。
 * 输出 5x5 矩阵：5 个参数 × 5 个调整档。
 */
export function analyzeSensitivity(
  input: BlastScenarioInput,
  normalized: NormalizedParameterSet,
  scoreRef: SchemeScore,
): SensitivityMatrix {
  const axes = [
    "linearChargeDensity",
    "holeSpacing",
    "maxChargePerDelay",
    "stemmingLength",
    "burdenDistance",
  ] as const;
  const deltas = [-0.15, -0.08, 0, 0.08, 0.15];

  const cells: SensitivityCell[] = [];
  axes.forEach((paramKey) => {
    deltas.forEach((d, idx) => {
      /** demo 简化：Δ 引起 overall 评分变化；
       *  Δ 对装药/单响放大时 safety 降，economy 升；
       *  Δ 对孔距、堵塞、抵抗线主要影响 suitability。
       */
      const adjusted: NormalizedParameterSet = adjustNormalized(normalized, paramKey, d);
      const nextScore = calculateSchemeScore(input, adjusted, "recommended");
      const outputDelta = nextScore.overall - scoreRef.overall;
      cells.push({
        parameterKey: paramKey,
        delta: idx - 2, // -2..+2
        outputDelta: Math.round(outputDelta * 10) / 10,
      });
    });
  });

  return { axes: [...axes], cells };
}

function adjustNormalized(
  base: NormalizedParameterSet,
  paramKey: string,
  fraction: number,
): NormalizedParameterSet {
  const factor = 1 + fraction;
  switch (paramKey) {
    case "linearChargeDensity":
      return {
        ...base,
        linearChargeDensity: Number((base.linearChargeDensity * factor).toFixed(2)),
        totalChargeKg: Number((base.totalChargeKg * factor).toFixed(1)),
      };
    case "holeSpacing":
      return {
        ...base,
        holeSpacing: Number((base.holeSpacing * factor).toFixed(2)),
      };
    case "maxChargePerDelay":
      return {
        ...base,
        maxChargePerDelay: Math.max(
          5,
          Math.round(base.maxChargePerDelay * factor),
        ),
      };
    case "stemmingLength":
      return {
        ...base,
        stemmingLength: Number((base.stemmingLength * factor).toFixed(2)),
      };
    case "burdenDistance":
      return {
        ...base,
        burdenDistance: Number((base.burdenDistance * factor).toFixed(2)),
      };
    default:
      return base;
  }
}

/* ----------- Step 9: 步骤事件组装 ----------- */

export const PLANNING_STEPS: ReadonlyArray<{
  id: PlanningStepId;
  label: string;
  description: string;
}> = [
  {
    id: "validate_input",
    label: "校验输入",
    description: "Zod 校验工程条件与可选参数。",
  },
  {
    id: "normalize_parameters",
    label: "标准化参数",
    description: "统一单位、估算孔网参数、推导装药结构。",
  },
  {
    id: "run_rule_precheck",
    label: "规则预检",
    description: "执行确定性工程规则，输出危险与告警列表。",
  },
  {
    id: "plan_parameters",
    label: "规划参数",
    description: "为各方案风格生成参数预测。",
  },
  {
    id: "generate_schemes",
    label: "生成方案",
    description: "形成推荐 / 备选 / 风险方案候选。",
  },
  {
    id: "calculate_scores",
    label: "计算评分",
    description: "按多指标加权计算方案评分。",
  },
  {
    id: "review_safety",
    label: "安全复核",
    description: "Safety Reviewer Agent 汇总阻断条件。",
  },
  {
    id: "await_human_review",
    label: "等待人工复核",
    description: "高敏感或高风险参数要求人工确认。",
  },
];

export function buildInitialStepEvents(): PlanningStepEvent[] {
  return PLANNING_STEPS.map((s) => ({
    id: s.id,
    status: "pending",
    label: s.label,
  }));
}

export interface WorkflowStepUpdate {
  id: PlanningStepId;
  status: PlanningStepStatus;
  detail?: string;
}

/* ----------- Step 10: 状态聚合 ----------- */

export interface PlanningRunSummary {
  status: PlanningRunStatus;
  blockedReason?: string;
}

/**
 * 根据规则 issues + 风险 + 输入得到总体状态与 blockedReason。
 * 优先级：blocked > awaiting_review > running。
 */
export function summarizeRunStatus(
  ruleIssues: readonly RuleCheckIssue[],
  hasMissingRequired: boolean,
): PlanningRunSummary {
  /** blocked 优先：只要存在 danger 级别规则，运行即被 Safety Reviewer 阻断 */
  if (hasBlockingRuleIssue(ruleIssues)) {
    return {
      status: "blocked",
      blockedReason:
        "Safety Reviewer 已阻断运行。请查看风险列表与建议，逐条处置后重新执行。",
    };
  }

  if (hasMissingRequired) {
    return {
      status: "awaiting_review",
      blockedReason:
        "存在必填参数缺失，需人工补充并重新规划。",
    };
  }

  if (ruleIssues.some((i) => i.severity === "warning")) {
    return { status: "running" };
  }

  return { status: "running" };
}

/* ----------- Step 11: Sort Schemes ----------- */

export function sortSchemesByOverall(schemes: readonly Scheme[]): readonly Scheme[] {
  return [...schemes].sort((a, b) => {
    /** recommended 优先，alternative 次之，risk 最后 */
    const order: Record<SchemeCategory, number> = {
      recommended: 0,
      alternative: 1,
      risk: 2,
    };
    if (order[a.category] !== order[b.category]) {
      return order[a.category] - order[b.category];
    }
    return b.score.overall - a.score.overall;
  });
}

/* ----------- 端到端 Demo 规划 ----------- */

export interface PlanningPipelineInput {
  input: BlastScenarioInput;
  /** 可选：预设项目 id */
  projectId?: string;
  presetId?: string;
  /** 当前 simulatedNowMs: 仅用于生成 createdAt，确保稳定测试 */
  simulatedNowIso?: string;
}

export interface PlanningPipelineResult {
  steps: readonly PlanningStepEvent[];
  run: import("./contracts").PlanningRun;
}

/**
 * 高阶端到端：编排所有步骤。
 * 同时支持 cancel：调用方应记录 cancelled 状态并停止等待动画。
 */
export function planDemo(input: PlanningPipelineInput): PlanningPipelineResult {
  const fingerprint = fingerprintInput(input.input);
  const runId = makeDemoDeterministicId("run", fingerprint, 0);
  const createdAt = input.simulatedNowIso ?? "2026-07-04T00:00:00+08:00";

  const normalized = normalizeParameters(input.input);
  const ruleIssues = runRulePrecheck(input.input, normalized);
  const schemeSet = generateSchemes(input.input, normalized, ruleIssues);
  const sortedSchemes = sortSchemesByOverall(schemeSet.schemes);
  const orderedSet: SchemeSet = {
    ...schemeSet,
    schemes: sortedSchemes,
  };
  const risks = collectRisks(input.input, ruleIssues, sortedSchemes);
  const reviews = collectReviewRequirements(input.input, ruleIssues, sortedSchemes);
  const recommendedScheme =
    sortedSchemes.find((s) => s.category === "recommended") ?? sortedSchemes[0];
  const sensitivity = analyzeSensitivity(
    input.input,
    normalized,
    recommendedScheme?.score ?? {
      safety: 50,
      suitability: 50,
      economy: 50,
      convenience: 50,
      environment: 50,
      overall: 50,
    },
  );

  const hasMissingRequired = ruleIssues.some(
    (i) => i.code === "INPUT_V_MISSING" && i.severity === "danger",
  );
  const summary = summarizeRunStatus(ruleIssues, hasMissingRequired);

  const steps = buildInitialStepEvents().map((s) => {
    if (summary.status === "blocked" && s.id === "review_safety") {
      return { ...s, status: "blocked" as const };
    }
    return s;
  });

  const run = {
    id: runId,
    projectId: input.projectId,
    presetId: input.presetId,
    input: input.input,
    normalized,
    ruleIssues,
    schemeSet: orderedSet,
    risks,
    reviews,
    sensitivity,
    steps,
    status: summary.status,
    selectedSchemeId: recommendedScheme?.id ?? orderedSet.recommendedId,
    blockedReason: summary.blockedReason,
    createdAt,
  };

  return { steps, run };
}

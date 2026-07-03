/**
 * Demo Replay —— 预录制 Run 数据。
 *
 * 当 Provider Adapter 不可用 / 模型超时 / 输出无法校验时，
 * Orchestrator 自动选择预设对应的 Replay 数据驱动 Workflow 动画，
 * 让页面继续呈现"真实"的事件流。
 *
 * 位置：`src/modules/agent-runtime/core/replay-data.ts`（构建时常量）；
 *       对应原始数据：`src/modules/parameter-planning/domain/presets.ts`。
 *
 * 不在文件中存储任何真实凭据或用户敏感信息。
 */

import type { Citation } from "./contracts";
import type {
  NormalizedParameterSet,
  RuleCheckIssue,
  Scheme,
  SensitivityMatrix,
} from "@/modules/parameter-planning/domain/contracts";

export interface DemoReplay {
  presetId: string;
  /** 标准化参数（与 planDemo 输出对齐） */
  normalized: NormalizedParameterSet;
  /** 规则 issues（含 danger 级别触发 blocked） */
  ruleIssues: readonly RuleCheckIssue[];
  /** 知识引用（与 SearchKnowledge 输出一致） */
  citations: readonly Citation[];
  /** 方案集合（与 planDemo 输出对齐） */
  schemes: readonly Scheme[];
  /** 敏感性矩阵（与 planDemo 输出对齐） */
  sensitivity: SensitivityMatrix;
  /** 是否高风险阻断（true → Safety Reviewer 阻断） */
  highRisk: boolean;
}

const replays: Record<string, DemoReplay> = {};

function register(replay: DemoReplay): void {
  replays[replay.presetId] = replay;
}

register({
  presetId: "standard",
  highRisk: false,
  normalized: {
    engineeringTypeLabel: "露天深孔台阶",
    rockCategoryLabel: "中硬岩",
    protodyakonov: 8,
    benchHeight: 12,
    holeDiameter: 138,
    holeDepth: 12.5,
    stemmingLength: 3.2,
    holeSpacing: 5.1,
    rowSpacing: 4.3,
    burdenDistance: 4.5,
    chargeStructure: "coupled",
    linearChargeDensity: 4.2,
    maxChargePerDelay: 64,
    totalChargeKg: 248.4,
    peakParticleVelocity: 5,
  },
  ruleIssues: [
    {
      code: "RULE_TOTAL_DEMO_HINT",
      message: "Demo 总装药量为模拟值，请勿用于现场控制。",
      severity: "info",
    },
  ],
  citations: [
    {
      id: "cit-doc-001",
      documentId: "doc-001",
      documentTitle: "爆破安全规程（GB 6722-2014）摘要",
      category: "规范",
      page: 12,
      section: "4.2 露天深孔台阶",
      excerpt: "露天深孔台阶爆破应按设计孔网参数、装药结构、最大单响药量进行控制。",
      score: 0.92,
    },
    {
      id: "cit-doc-004",
      documentId: "doc-004",
      documentTitle: "节理裂隙岩体爆破参数建议",
      category: "教材",
      section: "3.1 孔距系数",
      excerpt: "节理发育岩体建议孔距系数取 1.0–1.2，并加密堵塞长度。",
      score: 0.71,
    },
  ],
  schemes: [],
  sensitivity: {
    axes: ["linearChargeDensity", "holeSpacing", "maxChargePerDelay", "stemmingLength", "burdenDistance"],
    cells: [],
  },
});

register({
  presetId: "complex",
  highRisk: false,
  normalized: {
    engineeringTypeLabel: "隧道掘进",
    rockCategoryLabel: "中硬偏硬岩",
    protodyakonov: 10,
    benchHeight: 4,
    holeDiameter: 76,
    holeDepth: 4.2,
    stemmingLength: 1.5,
    holeSpacing: 1.4,
    rowSpacing: 1.2,
    burdenDistance: 0.6,
    chargeStructure: "decked",
    linearChargeDensity: 3.6,
    maxChargePerDelay: 22,
    totalChargeKg: 84,
    peakParticleVelocity: 2,
  },
  ruleIssues: [
    {
      code: "RULE_STEMMING_SHORT",
      message: "堵塞长度偏短，可能增加飞石风险。",
      severity: "warning",
      advice: "建议增加堵塞长度至 ≥ 1.2 倍抵抗线。",
      paramKey: "stemmingLength",
    },
  ],
  citations: [
    {
      id: "cit-doc-002",
      documentId: "doc-002",
      documentTitle: "乳化炸药性能与适用场景",
      category: "材料",
      section: "2.3 抗水性",
      excerpt: "抗水性优于铵油炸药，适用于含水炮孔；建议临界直径不小于 25mm。",
      score: 0.88,
    },
    {
      id: "cit-doc-003",
      documentId: "doc-003",
      documentTitle: "城镇周边控制爆破案例库",
      category: "案例",
      page: 47,
      section: "案例 12",
      excerpt: "针对学校、居民区附近必须按允许振速 v=1.0 cm/s 进行试爆校核。",
      score: 0.84,
    },
    {
      id: "cit-doc-006",
      documentId: "doc-006",
      documentTitle: "隧道掘进装药结构经验",
      category: "教材",
      section: "4.4 间隔装药",
      excerpt: "隧道掘进常采用间隔装药结构并配置高精度雷管，减少单响药量。",
      score: 0.73,
    },
  ],
  schemes: [],
  sensitivity: {
    axes: ["linearChargeDensity", "holeSpacing", "maxChargePerDelay", "stemmingLength", "burdenDistance"],
    cells: [],
  },
});

register({
  presetId: "high-risk",
  highRisk: true,
  normalized: {
    engineeringTypeLabel: "城市基坑",
    rockCategoryLabel: "中硬岩",
    protodyakonov: 6,
    benchHeight: 6,
    holeDiameter: 89,
    holeDepth: 6.5,
    stemmingLength: 1.6,
    holeSpacing: 3.0,
    rowSpacing: 2.5,
    burdenDistance: 2.6,
    chargeStructure: "decoupled",
    linearChargeDensity: 2.4,
    maxChargePerDelay: 18,
    totalChargeKg: 96,
    peakParticleVelocity: 1.0,
  },
  ruleIssues: [
    {
      code: "INPUT_V_MISSING",
      message: "高敏感场景未提供允许振速（v）参数",
      severity: "danger",
      paramKey: "peakParticleVelocity",
      advice: "请补充年允许峰值振速（cm/s）或选择中等敏感度。",
    },
    {
      code: "RULE_FLYROCK_RESIDENTIAL",
      message: "居民/学校附近评估为高飞石风险，必须人工降级方案或增加覆盖。",
      severity: "danger",
      paramKey: "flyrockRisk",
    },
    {
      code: "RULE_DELAY_VIOLATION",
      message: "高敏感环境 + 单响药量偏高，建议减小单段药量或增加分段。",
      severity: "danger",
      paramKey: "maxChargePerDelay",
    },
  ],
  citations: [
    {
      id: "cit-doc-003",
      documentId: "doc-003",
      documentTitle: "城镇周边控制爆破案例库",
      category: "案例",
      page: 47,
      section: "案例 12",
      excerpt: "针对学校、居民区附近必须按允许振速 v=1.0 cm/s 进行试爆校核。",
      score: 0.95,
    },
    {
      id: "cit-doc-005",
      documentId: "doc-005",
      documentTitle: "高敏感环境最大单响估算",
      category: "规范",
      page: 18,
      section: "5.1 振动控制",
      excerpt: "高敏感环境应按 v ≤ 1.0 cm/s 控制，并通过试爆校核最大单响药量。",
      score: 0.89,
    },
  ],
  schemes: [],
  sensitivity: {
    axes: ["linearChargeDensity", "holeSpacing", "maxChargePerDelay", "stemmingLength", "burdenDistance"],
    cells: [],
  },
});

export function listReplays(): readonly DemoReplay[] {
  return Object.values(replays);
}

export function getReplay(presetId: string): DemoReplay | null {
  return replays[presetId] ?? null;
}
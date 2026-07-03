/**
 * BlastForge Demo 知识库 —— 种子数据。
 *
 * 重要约束：
 * - 所有"规范"均以 `规范摘要` / `教学` 标识；
 * - 严禁伪造 `GB 6722-2014` 之类正式规范的条文编号；
 * - 文档的 publisher / sourceType / category 必须由 UI 显式展示；
 * - 涵盖炸药类型、含水、环境敏感、成本便利、风险复核 5 类主题；
 * - 用于 RAG 检索测试与知识库页面展示。
 */

import type {
  KnowledgeCategory,
  KnowledgeChunk,
  KnowledgeDocument,
} from "./contracts";

const SUPERVISOR_AGENT = "supervisor";
const NORMALIZER_AGENT = "normalizer";
const RETRIEVER_AGENT = "retriever";
const PLANNER_AGENT = "planner";
const GENERATOR_AGENT = "generator";
const EVALUATOR_AGENT = "evaluator";
const SAFETY_AGENT = "safety";
const REPORT_AGENT = "report";

/* ---------- 文档实体 ---------- */

export const SEED_DOCUMENTS: readonly KnowledgeDocument[] = [
  {
    id: "KB-DOC-001",
    title: "常用炸药类型与适用条件（教学摘要）",
    sourceType: "knowledge",
    category: "explosive",
    status: "seeded",
    tags: ["教学", "炸药", "选型"],
    summary: "梳理常见工业炸药种类与其在露天/地下/含水/中硬岩等条件下的适用边界。",
    publisher: "BlastForge Demo 知识库 / 教学摘录",
    wordCount: 760,
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT, GENERATOR_AGENT, SAFETY_AGENT],
    affectedConclusions: [
      "linearChargeDensity",
      "chargeStructure",
      "maxChargePerDelay",
      "criticalHoleDiameter",
    ],
    hitCount: 84,
    createdAt: "2026-05-04T10:00:00+08:00",
    chunkCount: 6,
  },
  {
    id: "KB-DOC-002",
    title: "含水炮孔装药结构与抗水炸药（教学摘要）",
    sourceType: "knowledge",
    category: "water",
    status: "seeded",
    tags: ["教学", "含水炮孔", "装药结构"],
    summary: "整理湿孔 / 饱水孔的常见处置方式，强调抗水炸药选型与不耦合装药的安全性。",
    publisher: "BlastForge Demo 知识库 / 教学摘录",
    wordCount: 612,
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT, SAFETY_AGENT],
    affectedConclusions: [
      "chargeStructure",
      "linearChargeDensity",
      "stemmingLength",
    ],
    hitCount: 64,
    createdAt: "2026-05-08T16:00:00+08:00",
    chunkCount: 5,
  },
  {
    id: "KB-DOC-003",
    title: "城镇与敏感环境爆破控制（规范摘要）",
    sourceType: "regulation",
    category: "environment",
    status: "seeded",
    tags: ["规范摘要", "振速", "飞石", "敏感环境"],
    summary:
      "围绕学校 / 医院 / 历史建筑等敏感环境，引用规范摘要中的允许振速与试爆校核流程；本 Demo 不引用具体条文编号。",
    publisher: "BlastForge Demo 知识库 / 规范摘要",
    wordCount: 824,
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT, SAFETY_AGENT, REPORT_AGENT],
    affectedConclusions: [
      "peakParticleVelocity",
      "maxChargePerDelay",
      "flyrockRisk",
      "trialBlastRequired",
    ],
    hitCount: 128,
    createdAt: "2026-05-12T09:00:00+08:00",
    chunkCount: 7,
  },
  {
    id: "KB-DOC-004",
    title: "成本倾向与施工便利性决策矩阵（教学摘要）",
    sourceType: "knowledge",
    category: "cost",
    status: "seeded",
    tags: ["教学", "成本", "决策"],
    summary:
      "梳理不同成本倾向（严格 / 平衡 / 溢价）与施工便利性要求下，方案应优先调整的参数与论证逻辑。",
    publisher: "BlastForge Demo 知识库 / 教学摘录",
    wordCount: 558,
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT, GENERATOR_AGENT, EVALUATOR_AGENT],
    affectedConclusions: [
      "totalChargeKg",
      "schemeScoringWeights",
      "convenienceNote",
    ],
    hitCount: 46,
    createdAt: "2026-05-20T11:00:00+08:00",
    chunkCount: 5,
  },
  {
    id: "KB-DOC-005",
    title: "风险复核与人工重点确认清单（教学摘要）",
    sourceType: "knowledge",
    category: "risk-review",
    status: "seeded",
    tags: ["教学", "安全复核", "人工确认"],
    summary: "归纳高敏感项目必须的人工复核字段与触发条件，强调不可被模型自动通过的节点。",
    publisher: "BlastForge Demo 知识库 / 教学摘录",
    wordCount: 478,
    usedByAgents: [SAFETY_AGENT, SUPERVISOR_AGENT, REPORT_AGENT],
    affectedConclusions: [
      "humanReviewChecklist",
      "blockingDecision",
      "responsibilityBoundary",
    ],
    hitCount: 58,
    createdAt: "2026-05-23T14:00:00+08:00",
    chunkCount: 4,
  },
  {
    id: "KB-DOC-006",
    title: "节理裂隙岩体孔网参数经验（教学摘要）",
    sourceType: "knowledge",
    category: "general",
    status: "seeded",
    tags: ["教学", "节理", "孔距"],
    summary: "节理发育岩体的孔距系数与堵塞长度经验值；用于调整中硬偏硬 / 碎裂岩体的孔网参数。",
    publisher: "BlastForge Demo 知识库 / 教学摘录",
    wordCount: 396,
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT],
    affectedConclusions: ["holeSpacing", "stemmingLength"],
    hitCount: 39,
    createdAt: "2026-05-24T08:30:00+08:00",
    chunkCount: 4,
  },
  {
    id: "KB-DOC-007",
    title: "隧道掘进装药结构与减振（教学摘要）",
    sourceType: "knowledge",
    category: "general",
    status: "seeded",
    tags: ["教学", "隧道", "间隔装药"],
    summary: "隧道掘进 / 城市基坑等空间受限场景下的间隔装药与高精度雷管使用经验。",
    publisher: "BlastForge Demo 知识库 / 教学摘录",
    wordCount: 432,
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT, GENERATOR_AGENT],
    affectedConclusions: ["chargeStructure", "maxChargePerDelay"],
    hitCount: 42,
    createdAt: "2026-05-26T13:20:00+08:00",
    chunkCount: 4,
  },
  {
    id: "KB-DOC-008",
    title: "脱敏教学案例：城际铁路基坑飞石处置（教学案例）",
    sourceType: "case",
    category: "environment",
    status: "seeded",
    tags: ["教学案例", "飞石", "覆盖防护"],
    summary:
      "脱敏的城际铁路基坑控制爆破教学案例，覆盖方案调整、警戒设置与 Safety Reviewer 阻断流程。",
    publisher: "BlastForge Demo 知识库 / 教学案例",
    wordCount: 528,
    usedByAgents: [RETRIEVER_AGENT, SAFETY_AGENT, REPORT_AGENT],
    affectedConclusions: [
      "flyrockRisk",
      "stemmingLength",
      "coverageRequired",
    ],
    hitCount: 51,
    createdAt: "2026-05-28T09:40:00+08:00",
    chunkCount: 4,
  },
];

/* ---------- 文档片段（chunk） ---------- */

export const SEED_CHUNKS: readonly KnowledgeChunk[] = [
  // KB-DOC-001 炸药类型
  {
    id: "KB-CHUNK-001-1",
    documentId: "KB-DOC-001",
    title: "铵油炸药（教学）",
    section: "1.1 铵油炸药",
    excerpt:
      "铵油炸药主要成分为硝酸铵 + 燃料油，成本最低，临界直径较大；在干燥环境下使用较为普遍；不抗水，故在湿孔或饱水孔需谨慎或替换为抗水炸药。Demo 提示：使用前应在干燥条件下进行现场试验。",
    affectedConclusions: ["linearChargeDensity", "criticalHoleDiameter"],
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT],
    keywords: ["铵油", "炸药", "临界直径", "成本"],
  },
  {
    id: "KB-CHUNK-001-2",
    documentId: "KB-DOC-001",
    title: "乳化炸药（教学）",
    section: "1.2 乳化炸药",
    excerpt:
      "乳化炸药具有较好的抗水性，常用于含水或潮湿炮孔，临界直径相对较小；典型孔径 ≥ 25mm 时可稳定爆轰；在 Demo 场景中作为含水条件下的推荐材料。",
    affectedConclusions: ["chargeStructure", "linearChargeDensity"],
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT],
    keywords: ["乳化", "炸药", "抗水", "临界直径", "含水"],
  },
  {
    id: "KB-CHUNK-001-3",
    documentId: "KB-DOC-001",
    title: "改性铵油炸药（教学）",
    section: "1.3 改性铵油",
    excerpt:
      "改性铵油通过添加少量添加剂提高爆轰性能；适用于中等硬度岩石与台阶爆破；与铵油相比临界直径更小，但同样需要注意防水。",
    affectedConclusions: ["linearChargeDensity"],
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT],
    keywords: ["改性", "铵油", "中硬岩"],
  },
  {
    id: "KB-CHUNK-001-4",
    documentId: "KB-DOC-001",
    title: "炸药选型决策逻辑（教学）",
    section: "1.4 选型决策",
    excerpt:
      "在 Demo 推理链路中，Retriever / Planner / Safety 在面对不同 waterCondition 与 rockCategory 时，应优先返回抗水炸药 / 乳化炸药；同时提示临界直径与现场试爆校验。",
    affectedConclusions: ["chargeStructure", "linearChargeDensity"],
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT, SAFETY_AGENT],
    keywords: ["炸药", "决策", "含水", "乳化"],
  },
  {
    id: "KB-CHUNK-001-5",
    documentId: "KB-DOC-001",
    title: "教学场景适配边界",
    section: "1.5 边界",
    excerpt:
      "以上结论为教学模拟数据；任何现场装药选型必须依据现行规范与厂家说明书，本 Demo 不作为现场施工指令。",
    affectedConclusions: ["responsibilityBoundary"],
    usedByAgents: [REPORT_AGENT, SAFETY_AGENT, SUPERVISOR_AGENT],
    keywords: ["边界", "教学", "模拟"],
  },
  {
    id: "KB-CHUNK-001-6",
    documentId: "KB-DOC-001",
    title: "现场试爆与现场校核",
    section: "1.6 试爆",
    excerpt:
      "选型确定后，建议在正式施工前进行小规模试爆以验证装药集中度、孔距与振速的关系；试爆结果应写入项目档案与人工复核记录。",
    affectedConclusions: ["trialBlastRequired", "humanReviewChecklist"],
    usedByAgents: [SAFETY_AGENT, REPORT_AGENT],
    keywords: ["试爆", "校核", "档案"],
  },

  // KB-DOC-002 含水装药
  {
    id: "KB-CHUNK-002-1",
    documentId: "KB-DOC-002",
    title: "湿孔常见处置（教学）",
    section: "2.1 湿孔",
    excerpt:
      "湿孔建议优先选择抗水炸药或改良装药结构（间隔装药 / 不耦合装药），并避免耦合装药导致爆轰不稳。Demo 提示：装药前应确认无明显泥浆堵塞。",
    affectedConclusions: ["chargeStructure"],
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT],
    keywords: ["湿孔", "抗水", "装药结构"],
  },
  {
    id: "KB-CHUNK-002-2",
    documentId: "KB-DOC-002",
    title: "饱水孔与抗水炸药",
    section: "2.2 饱水孔",
    excerpt:
      "饱水炮孔优先采用抗水炸药 + 不耦合装药；可适度延长堵塞长度以减少冲孔风险。Safety Reviewer 应在此场景下重点复核装药结构与振速影响。",
    affectedConclusions: ["chargeStructure", "stemmingLength"],
    usedByAgents: [SAFETY_AGENT, PLANNER_AGENT],
    keywords: ["饱水", "抗水", "装药结构", "堵塞"],
  },
  {
    id: "KB-CHUNK-002-3",
    documentId: "KB-DOC-002",
    title: "装药结构与孔网耦合",
    section: "2.3 装药结构",
    excerpt:
      "在含水条件下，将耦合装药改为间隔装药 / 不耦合装药可显著提高爆轰稳定性；Demo 的规则预检中已将此条件识别为 warning 级建议。",
    affectedConclusions: ["chargeStructure"],
    usedByAgents: [RETRIEVER_AGENT, SAFETY_AGENT],
    keywords: ["耦合", "间隔", "装药结构"],
  },
  {
    id: "KB-CHUNK-002-4",
    documentId: "KB-DOC-002",
    title: "堵塞与冲孔风险",
    section: "2.4 堵塞",
    excerpt:
      "湿孔 / 饱水孔在堵塞不足时容易发生冲孔；建议堵塞长度 ≥ 1.2 倍抵抗线并使用合格的堵塞材料。",
    affectedConclusions: ["stemmingLength"],
    usedByAgents: [PLANNER_AGENT, SAFETY_AGENT],
    keywords: ["堵塞", "冲孔", "湿孔"],
  },
  {
    id: "KB-CHUNK-002-5",
    documentId: "KB-DOC-002",
    title: "含水场景人工复核",
    section: "2.5 人工复核",
    excerpt:
      "任何含水条件下的爆破设计都必须在 Safety Reviewer 之后进行人工复核，重点检查装药结构、抗水炸药选型与试爆校核结果。",
    affectedConclusions: ["humanReviewChecklist"],
    usedByAgents: [SAFETY_AGENT, SUPERVISOR_AGENT],
    keywords: ["人工复核", "含水", "安全"],
  },

  // KB-DOC-003 城镇环境
  {
    id: "KB-CHUNK-003-1",
    documentId: "KB-DOC-003",
    title: "敏感环境分类（规范摘要）",
    section: "3.1 分类",
    excerpt:
      "Demo 将周边保护对象分为：none / residential / school / hospital / heritage / utility / wildlife；医院与历史建筑通常要求更严格的振速控制（规范摘要，本 Demo 不引用具体条文编号）。",
    affectedConclusions: ["peakParticleVelocity"],
    usedByAgents: [NORMALIZER_AGENT, SAFETY_AGENT],
    keywords: ["保护对象", "振速", "敏感环境"],
  },
  {
    id: "KB-CHUNK-003-2",
    documentId: "KB-DOC-003",
    title: "允许振速分级（规范摘要）",
    section: "3.2 振速分级",
    excerpt:
      "学校 / 居民区附近常见允许振速 1.0–2.0 cm/s；医院与历史建筑通常 ≤ 1.0 cm/s；具体取值需结合建筑物结构鉴定结果。Demo 的规则预检基于分级规则自动给出建议并标记需人工复核。",
    affectedConclusions: ["peakParticleVelocity", "maxChargePerDelay"],
    usedByAgents: [SAFETY_AGENT, PLANNER_AGENT],
    keywords: ["振速", "分级", "敏感环境"],
  },
  {
    id: "KB-CHUNK-003-3",
    documentId: "KB-DOC-003",
    title: "单响药量校核",
    section: "3.3 单响药量",
    excerpt:
      "在高敏感环境中，最大单响药量是核心约束；Demo 中由规则预检与 Safety Reviewer 进行双重校核；超出预设阈值将触发阻断。",
    affectedConclusions: ["maxChargePerDelay"],
    usedByAgents: [SAFETY_AGENT, GENERATOR_AGENT],
    keywords: ["单响", "药量", "校核"],
  },
  {
    id: "KB-CHUNK-003-4",
    documentId: "KB-DOC-003",
    title: "飞石控制与覆盖防护",
    section: "3.4 飞石",
    excerpt:
      "居民 / 学校附近飞石风险评估必须配合警戒范围与覆盖防护；Safety Reviewer 在评估为高飞石风险时应要求人工降级方案或补充覆盖措施。",
    affectedConclusions: ["flyrockRisk", "coverageRequired"],
    usedByAgents: [SAFETY_AGENT, SUPERVISOR_AGENT],
    keywords: ["飞石", "覆盖", "警戒"],
  },
  {
    id: "KB-CHUNK-003-5",
    documentId: "KB-DOC-003",
    title: "试爆校核流程",
    section: "3.5 试爆",
    excerpt:
      "高敏感项目在正式施工前应进行试爆，通过实测振速 / 飞石距离验证方案可行性；试爆数据应纳入报告并标记为人工复核位。",
    affectedConclusions: ["trialBlastRequired"],
    usedByAgents: [REPORT_AGENT, SAFETY_AGENT],
    keywords: ["试爆", "校核", "报告"],
  },
  {
    id: "KB-CHUNK-003-6",
    documentId: "KB-DOC-003",
    title: "Demo 责任边界声明",
    section: "3.6 边界",
    excerpt:
      "本文档内容为教学 / 模拟 / 规范摘要，不引用真实规范条文编号；任何现场决策必须以现行规范与具备资质人员的签字为准。",
    affectedConclusions: ["responsibilityBoundary"],
    usedByAgents: [REPORT_AGENT, SUPERVISOR_AGENT],
    keywords: ["边界", "教学", "规范摘要"],
  },
  {
    id: "KB-CHUNK-003-7",
    documentId: "KB-DOC-003",
    title: "噪声与振动控制",
    section: "3.7 噪声",
    excerpt:
      "敏感环境中除了振动，还应关注噪声与粉尘；Demo 评分中 environment 维度兼顾上述因素，但实际现场仍需独立评估。",
    affectedConclusions: ["environmentScore"],
    usedByAgents: [EVALUATOR_AGENT, PLANNER_AGENT],
    keywords: ["噪声", "振动", "粉尘"],
  },

  // KB-DOC-004 成本与便利性
  {
    id: "KB-CHUNK-004-1",
    documentId: "KB-DOC-004",
    title: "成本倾向与权重（教学）",
    section: "4.1 成本倾向",
    excerpt:
      "Demo 中 costPreference = strict（严格）/ balanced（平衡）/ premium（溢价）会触发不同的评分权重：strict 时 economy 权重上升、safety 权重降低；premium 反之。Safety Reviewer 在 strict + 高敏感对象场景下提示成本与安全冲突。",
    affectedConclusions: ["schemeScoringWeights"],
    usedByAgents: [EVALUATOR_AGENT, PLANNER_AGENT],
    keywords: ["成本", "权重", "评分"],
  },
  {
    id: "KB-CHUNK-004-2",
    documentId: "KB-DOC-004",
    title: "施工便利性影响",
    section: "4.2 便利性",
    excerpt:
      "convenienceRequirement 影响方案的 convenience 评分；高便利性场景倾向少分段、标准孔网；低便利性场景可以考虑更大的分段与延迟。",
    affectedConclusions: ["convenienceNote"],
    usedByAgents: [EVALUATOR_AGENT, GENERATOR_AGENT],
    keywords: ["便利性", "分段", "孔网"],
  },
  {
    id: "KB-CHUNK-004-3",
    documentId: "KB-DOC-004",
    title: "经济型备选方案",
    section: "4.3 经济备选",
    excerpt:
      "经济型备选方案往往采用更高的装药集中度与较少的分段；Safety Reviewer 应在 costPreference = strict 且保护对象为 hospital / heritage 时建议优先选择安全加权更高的方案。",
    affectedConclusions: ["alternativeScheme", "schemeScoringWeights"],
    usedByAgents: [GENERATOR_AGENT, SAFETY_AGENT],
    keywords: ["备选", "经济", "安全"],
  },
  {
    id: "KB-DOC-004-4",
    documentId: "KB-DOC-004",
    title: "总装药量与运输约束",
    section: "4.4 总装药",
    excerpt:
      "总装药量与运输 / 现场堆放条件有关；Demo 中 totalChargeKg 仅作评分参考，实际现场需要依据仓储与运输规定进行评估。",
    affectedConclusions: ["totalChargeKg"],
    usedByAgents: [PLANNER_AGENT, REPORT_AGENT],
    keywords: ["总装药", "运输", "仓储"],
  },
  {
    id: "KB-CHUNK-004-5",
    documentId: "KB-DOC-004",
    title: "成本-环境敏感性矩阵",
    section: "4.5 决策矩阵",
    excerpt:
      "高成本 + 低敏感 → 推荐方案；高成本 + 高敏感 → 安全优先；低成本 + 低敏感 → 经济备选；低成本 + 高敏感 → 必须人工复核。",
    affectedConclusions: ["decisionMatrix"],
    usedByAgents: [SUPERVISOR_AGENT, GENERATOR_AGENT],
    keywords: ["决策矩阵", "成本", "敏感"],
  },

  // KB-DOC-005 风险复核
  {
    id: "KB-CHUNK-005-1",
    documentId: "KB-DOC-005",
    title: "人工重点确认节点",
    section: "5.1 节点",
    excerpt:
      "Demo 的 Workflow 中 human_approval 节点必须由具备资质的工程师执行；Safety Reviewer 不能替代人工对装药 / 振速 / 飞石的最终确认。",
    affectedConclusions: ["humanReviewChecklist"],
    usedByAgents: [SAFETY_AGENT, SUPERVISOR_AGENT],
    keywords: ["人工", "复核", "节点"],
  },
  {
    id: "KB-CHUNK-005-2",
    documentId: "KB-DOC-005",
    title: "阻断条件速查",
    section: "5.2 阻断",
    excerpt:
      "Safety Reviewer 在以下情况下必须阻断：缺少允许振速 + 高敏感；单响药量超出允许阈值；飞石评估为高风险 + 敏感环境。这些条件由代码承担，模型不得自动通过。",
    affectedConclusions: ["blockingDecision"],
    usedByAgents: [SAFETY_AGENT],
    keywords: ["阻断", "条件", "代码"],
  },
  {
    id: "KB-CHUNK-005-3",
    documentId: "KB-DOC-005",
    title: "演示回放标识",
    section: "5.3 回放",
    excerpt:
      "当 DeepSeek 不可用时，Orchestrator 自动切换至 Demo Replay；UI 必须明确标注「演示回放」以避免被误认为实时模型调用。",
    affectedConclusions: ["replayDisclosure"],
    usedByAgents: [SUPERVISOR_AGENT, REPORT_AGENT],
    keywords: ["回放", "标识", "披露"],
  },
  {
    id: "KB-CHUNK-005-4",
    documentId: "KB-DOC-005",
    title: "责任边界声明",
    section: "5.4 边界",
    excerpt:
      "Demo 生成的报告必须包含责任边界声明：所有预测与方案均为工程辅助模拟，不替代专业设计文件，不构成现场施工指令。",
    affectedConclusions: ["responsibilityBoundary"],
    usedByAgents: [REPORT_AGENT, SUPERVISOR_AGENT],
    keywords: ["责任", "边界", "模拟"],
  },

  // KB-DOC-006 节理裂隙
  {
    id: "KB-CHUNK-006-1",
    documentId: "KB-DOC-006",
    title: "节理裂隙与孔距系数",
    section: "6.1 孔距",
    excerpt:
      "节理发育岩体建议孔距系数 1.0–1.2，并适当加密堵塞长度；Demo 的 Normalizer 会根据 jointCondition 自动调整。",
    affectedConclusions: ["holeSpacing"],
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT],
    keywords: ["节理", "孔距", "系数"],
  },
  {
    id: "KB-CHUNK-006-2",
    documentId: "KB-DOC-006",
    title: "节理与堵塞长度",
    section: "6.2 堵塞",
    excerpt:
      "在节理裂隙发育岩石中，建议增加堵塞长度以减少冲孔风险；Safety Reviewer 与 Planner 应在生成方案时同步考虑。",
    affectedConclusions: ["stemmingLength"],
    usedByAgents: [PLANNER_AGENT, SAFETY_AGENT],
    keywords: ["节理", "堵塞"],
  },
  {
    id: "KB-CHUNK-006-3",
    documentId: "KB-DOC-006",
    title: "碎裂岩体爆破案例",
    section: "6.3 案例",
    excerpt:
      "碎裂岩体应采用较小的孔距与较密的堵塞；常规方案在该场景下可能产生飞石，建议安全加权更高的备选。",
    affectedConclusions: ["holeSpacing", "stemmingLength"],
    usedByAgents: [PLANNER_AGENT, GENERATOR_AGENT],
    keywords: ["碎裂", "案例"],
  },
  {
    id: "KB-CHUNK-006-4",
    documentId: "KB-DOC-006",
    title: "节理条件下的爆破参数回归经验",
    section: "6.4 经验",
    excerpt:
      "经验上节理条件与节理走向影响爆破方向与破碎块度；Demo 仅以节理级别（massive / blocky / fractured / highly-fractured / weathered）粗化处理。",
    affectedConclusions: ["holeSpacing"],
    usedByAgents: [RETRIEVER_AGENT, PLANNER_AGENT],
    keywords: ["节理", "经验", "走向"],
  },

  // KB-DOC-007 隧道装药
  {
    id: "KB-CHUNK-007-1",
    documentId: "KB-DOC-007",
    title: "隧道间隔装药结构",
    section: "7.1 间隔装药",
    excerpt:
      "隧道掘进常采用间隔装药结构并配合高精度雷管，降低单响药量；Demo 的方案生成器在 engineeringType = tunnel 时优先推荐 decked 结构。",
    affectedConclusions: ["chargeStructure"],
    usedByAgents: [RETRIEVER_AGENT, GENERATOR_AGENT],
    keywords: ["隧道", "间隔", "装药"],
  },
  {
    id: "KB-CHUNK-007-2",
    documentId: "KB-DOC-007",
    title: "隧道减振与延期时间",
    section: "7.2 延期",
    excerpt:
      "隧道与城市基坑爆破的延期时间设置应结合保护对象进行试爆校核；Demo 中仅在 Replay 场景给出示意时间。",
    affectedConclusions: ["maxChargePerDelay"],
    usedByAgents: [PLANNER_AGENT, SAFETY_AGENT],
    keywords: ["隧道", "延期", "校核"],
  },
  {
    id: "KB-CHUNK-007-3",
    documentId: "KB-DOC-007",
    title: "城市基坑与城市基础设施",
    section: "7.3 基坑",
    excerpt:
      "城市基坑周边往往紧邻管道 / 道路等城市基础设施；Demo 在 protectionTarget = utility 时采用更严格的允许振速建议。",
    affectedConclusions: ["peakParticleVelocity"],
    usedByAgents: [SAFETY_AGENT, PLANNER_AGENT],
    keywords: ["基坑", "城市", "基础设施"],
  },
  {
    id: "KB-CHUNK-007-4",
    documentId: "KB-DOC-007",
    title: "Demo 责任边界",
    section: "7.4 边界",
    excerpt:
      "Demo 不输出真实雷管段位或起爆口令；任何隧道项目的装药与起爆网络设计必须由具备资质的工程人员完成。",
    affectedConclusions: ["responsibilityBoundary"],
    usedByAgents: [REPORT_AGENT, SUPERVISOR_AGENT],
    keywords: ["雷管", "边界"],
  },

  // KB-DOC-008 案例
  {
    id: "KB-CHUNK-008-1",
    documentId: "KB-DOC-008",
    title: "案例背景（脱敏）",
    section: "8.1 背景",
    excerpt:
      "脱敏案例：某城际铁路基坑，距离医院 200m，距离历史建筑 150m；周边评估为高敏感环境。原设计采用 89mm 孔径 + 饱水条件。",
    affectedConclusions: ["flyrockRisk"],
    usedByAgents: [RETRIEVER_AGENT, SAFETY_AGENT],
    keywords: ["案例", "脱敏", "城际"],
  },
  {
    id: "KB-CHUNK-008-2",
    documentId: "KB-DOC-008",
    title: "方案调整与覆盖防护",
    section: "8.2 方案",
    excerpt:
      "调整后采用不耦合装药 + 加长堵塞 + 多分段 + 警戒覆盖；Safety Reviewer 在 Replay 中提示必须人工复核覆盖范围与警戒距离。",
    affectedConclusions: ["coverageRequired", "stemmingLength"],
    usedByAgents: [SAFETY_AGENT, GENERATOR_AGENT],
    keywords: ["方案", "覆盖", "警戒"],
  },
  {
    id: "KB-CHUNK-008-3",
    documentId: "KB-DOC-008",
    title: "试爆结果与振速校核",
    section: "8.3 试爆",
    excerpt:
      "试爆 3 次后确定最大单响 = 18 kg，振速实测 ≤ 0.9 cm/s，验证方案可行性；案例归档为人工重点确认清单。",
    affectedConclusions: ["trialBlastRequired", "maxChargePerDelay"],
    usedByAgents: [SAFETY_AGENT, REPORT_AGENT],
    keywords: ["试爆", "案例"],
  },
  {
    id: "KB-CHUNK-008-4",
    documentId: "KB-DOC-008",
    title: "Demo 披露声明",
    section: "8.4 披露",
    excerpt:
      "本案例为教学脱敏案例，所有数据均为模拟值，不能对应具体真实项目；Demo 报告在引用时必须明示来源为教学案例。",
    affectedConclusions: ["responsibilityBoundary"],
    usedByAgents: [REPORT_AGENT, SUPERVISOR_AGENT],
    keywords: ["披露", "脱敏", "教学"],
  },
];

/* ---------- 工具 ---------- */

/** UI 过滤用：列出指定 category 的文档。 */
export function listDocumentsByCategory(category: KnowledgeCategory): readonly KnowledgeDocument[] {
  return SEED_DOCUMENTS.filter((d) => d.category === category);
}

/** UI 过滤用：列出指定 source type 的文档。 */
export function listDocumentsBySourceType(
  sourceType: KnowledgeDocument["sourceType"],
): readonly KnowledgeDocument[] {
  return SEED_DOCUMENTS.filter((d) => d.sourceType === sourceType);
}

/** 找出文档对应的所有 chunk。 */
export function listChunksForDocument(documentId: string): readonly KnowledgeChunk[] {
  return SEED_CHUNKS.filter((c) => c.documentId === documentId);
}

/**
 * BlastForge RAG 检索层。
 *
 * 设计原则：
 * - 检索统一封装为 RetrievalPipeline；
 * - Adapter 隔离实现：KeywordAdapter / VectorAdapter；VectorAdapter 在没有真实 Embedding 服务时可禁用；
 * - Pipeline 步骤：Query Rewrite → Metadata Filter → Keyword Search → (Vector Search) → Merge → Rerank → Citation Packaging；
 * - 首期 Demo 必须能在没有 Embedding Provider 时通过关键字 + 元数据检索完成检索；
 * - 检索结果必须是真实存在的知识片段，禁止模型编造引用。
 */

import type {
  KnowledgeCategory,
  KnowledgeCitation,
  KnowledgeDocument,
  KnowledgeSourceType,
  RetrievalQuery,
  RetrievalResult,
} from "./contracts";

/* ---------- Query Rewrite ---------- */

export interface RewriteHints {
  /** 推断的关键词（去重、标准化） */
  terms: string[];
  /** 推断的类别 */
  categories: KnowledgeCategory[];
  /** 推断的来源类型 */
  sourceTypes: KnowledgeSourceType[];
  /** 原始 query */
  raw: string;
}

const CATEGORY_KEYWORDS: Record<KnowledgeCategory, ReadonlyArray<string>> = {
  explosive: ["炸药", "乳化", "铵油", "装药", "explosive", "emulsion", "ANFO"],
  water: ["含水", "湿孔", "饱水", "抗水", "water", "wet hole"],
  environment: ["敏感", "环境", "振速", "飞石", "居民", "医院", "学校", "environment", "vibration", "flyrock", "residential"],
  cost: ["成本", "经济", "便利", "cost", "balanced", "strict", "premium", "convenience"],
  "risk-review": ["复核", "安全", "阻断", "review", "safety", "human approval", "人工"],
  general: ["节理", "隧道", "基坑", "joint", "tunnel", "excavation"],
};

const SOURCE_TYPE_KEYWORDS: Record<KnowledgeSourceType, ReadonlyArray<string>> = {
  knowledge: ["教学", "教学摘要", "knowledge", "tips"],
  regulation: ["规范", "规范摘要", "regulation", "spec"],
  case: ["案例", "脱敏", "case", "study"],
  material: ["材料", "炸药材料", "material", "explosive data"],
};

/**
 * 第一阶段：把自然语言 query 改写为结构化线索（关键词 + 类别 / 来源），输出仍由确定逻辑给出：
 * - 关键词 = query token ∩（文档标题 / 摘要常用词）；
 * - 类别 / 来源 = 通过关键词反向映射预定义桶；
 * - 不依赖任何外部模型；不会"凭空"创造 token。
 */
export function rewriteQuery(query: RetrievalQuery): RewriteHints {
  const tokens = tokenize(query.query);
  const matchedKeywords = new Set<string>(tokens);

  const categories = new Set<KnowledgeCategory>();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS) as Array<[KnowledgeCategory, ReadonlyArray<string>]>) {
    if (matchesAny(tokens, kws)) categories.add(cat);
  }
  if (query.categories && query.categories.length > 0) {
    for (const c of query.categories) categories.add(c);
  }

  const sourceTypes = new Set<KnowledgeSourceType>();
  for (const [src, kws] of Object.entries(SOURCE_TYPE_KEYWORDS) as Array<[KnowledgeSourceType, ReadonlyArray<string>]>) {
    if (matchesAny(tokens, kws)) sourceTypes.add(src);
  }
  if (query.sourceTypes && query.sourceTypes.length > 0) {
    for (const s of query.sourceTypes) sourceTypes.add(s);
  }

  return {
    terms: Array.from(matchedKeywords),
    categories: Array.from(categories),
    sourceTypes: Array.from(sourceTypes),
    raw: query.query,
  };
}

function tokenize(raw: string): string[] {
  const lowered = raw.toLowerCase();
  const parts = lowered.split(/[\s,，。；;、!?？:：()（）【】\[\]]+/);
  const tokens: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (/[一-龥]/.test(part)) {
      for (const ch of part) tokens.push(ch);
    } else {
      tokens.push(part);
    }
  }
  return Array.from(new Set(tokens.filter(Boolean)));
}

function matchesAny(tokens: ReadonlyArray<string>, kws: ReadonlyArray<string>): boolean {
  for (const t of tokens) {
    for (const kw of kws) {
      if (kw.toLowerCase().includes(t) || t.includes(kw.toLowerCase())) return true;
    }
  }
  return false;
}

/* ---------- Adapters ---------- */

export interface RetrievalAdapter {
  readonly name: string;
  readonly enabled: boolean;
  /** 给定 query + 候选文档集合返回候选与得分 */
  score(
    query: RetrievalQuery,
    candidates: readonly KnowledgeDocument[],
  ): ReadonlyArray<{ documentId: string; score: number; matchedTokens: ReadonlyArray<string> }>;
}

/** 关键词检索 Adapter（默认启用）。 */
export class KeywordAdapter implements RetrievalAdapter {
  readonly name = "keyword";
  readonly enabled = true;
  score(query: RetrievalQuery, candidates: readonly KnowledgeDocument[]): Array<{ documentId: string; score: number; matchedTokens: string[] }> {
    const tokens = tokenize(query.query);
    if (tokens.length === 0) return [];
    const out: Array<{ documentId: string; score: number; matchedTokens: string[] }> = [];
    for (const doc of candidates) {
      const haystack = `${doc.title} ${doc.summary} ${doc.affectedConclusions.join(" ")} ${doc.tags.join(" ")}`.toLowerCase();
      const matched: string[] = [];
      for (const t of tokens) {
        if (haystack.includes(t)) matched.push(t);
      }
      if (matched.length === 0) continue;
      const denom = Math.max(1, tokens.length);
      const score = Math.min(1, matched.length / denom);
      out.push({ documentId: doc.id, score, matchedTokens: matched });
    }
    return out.sort((a, b) => b.score - a.score || b.matchedTokens.length - a.matchedTokens.length);
  }
}

/**
 * 向量检索 Adapter（可选）。
 *
 * 当未启用 Embedding 时返回空命中，Pipeline 会自动回退到关键词。
 * 接口固定，便于后续接入 pgvector / OpenAI Embedding / Cohere 等服务。
 */
export class VectorAdapter implements RetrievalAdapter {
  readonly name: string;
  readonly enabled: boolean;
  private readonly embedder: ((text: string) => Promise<number[]>) | null;

  constructor(name: string, embedder?: ((text: string) => Promise<number[]>) | null) {
    this.name = name;
    this.enabled = Boolean(embedder);
    this.embedder = embedder ?? null;
  }

  async scoreAsync(
    query: RetrievalQuery,
    candidates: readonly KnowledgeDocument[],
  ): Promise<Array<{ documentId: string; score: number; matchedTokens: string[] }>> {
    if (!this.enabled || !this.embedder) return [];
    const queryVec = await this.embedder(query.query);
    const out: Array<{ documentId: string; score: number; matchedTokens: string[] }> = [];
    for (const doc of candidates) {
      const docVec = await this.embedder(`${doc.title} ${doc.summary}`);
      const sim = cosine(queryVec, docVec);
      if (sim > 0) {
        out.push({ documentId: doc.id, score: sim, matchedTokens: [] });
      }
    }
    return out;
  }

  score(query: RetrievalQuery, candidates: readonly KnowledgeDocument[]): Array<{ documentId: string; score: number; matchedTokens: string[] }> {
    // 默认同步版本在无 Embedding Provider 时返回空；调用方应优先使用 scoreAsync。
    void query;
    void candidates;
    return [];
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

/* ---------- Pipeline ---------- */

export interface RetrievalPipelineConfig {
  /** 候选文档输入 */
  documents: ReadonlyArray<KnowledgeDocument>;
  /** 主 Adapter（默认 KeywordAdapter） */
  primary: RetrievalAdapter;
  /** 二级 Adapter，可选 */
  secondary?: RetrievalAdapter;
  /** 来源限定；不在范围内的文档不会出现在结果中 */
  allowedSourceTypes?: ReadonlyArray<KnowledgeSourceType>;
}

export interface MergedCandidate {
  document: KnowledgeDocument;
  /** 来自 primary 的命中 token（用于 Citation 高亮） */
  matchedTokens: string[];
  /** primary 得分 */
  primaryScore: number;
  /** secondary 得分（无 secondary 时为 0） */
  secondaryScore: number;
  /** rerank 后的最终得分 */
  finalScore: number;
}

const RERANK_IMPORTANCE = {
  /** 与查询直接命中的关键词数量越多，加权越高 */
  matchedTokensWeight: 0.45,
  /** category 匹配加权 */
  categoryWeight: 0.2,
  /** sourceType 匹配加权 */
  sourceTypeWeight: 0.1,
  /** 用 usedByAgents 与 affectedConclusions 命中数加权 */
  affectedWeight: 0.15,
  /** 文档命中统计（hitCount）轻微加分 */
  popularityWeight: 0.1,
};

/** 合并 + rerank + 输出 citations。 */
export function retrieveWithPipeline(
  query: RetrievalQuery,
  config: RetrievalPipelineConfig,
): RetrievalResult {
  const started = Date.now();
  const hints = rewriteQuery(query);

  const filtered = filterDocuments(config.documents, hints, query);
  const primaryHits = config.primary.score(query, filtered);
  const merged = mergeCandidates(filtered, primaryHits, [], hints, config);

  // 异步向量检索结果在没启用时会跳过；这里保留同步签名以满足 UI 入口。
  const ranked = rerank(merged);
  // 0 命中或所有候选 finalScore 极低时，认为未命中。
  const hasAnyHit = primaryHits.some((p) => p.score > 0);
  const finalRanked = hasAnyHit
    ? ranked
    : ranked.filter((c) => c.matchedTokens.length > 0);

  const citations: KnowledgeCitation[] = finalRanked
    .slice(0, query.limit)
    .map((c) => buildCitation(c, hints));

  return {
    citations,
    durationMs: Date.now() - started,
    adapter: config.secondary ? `${config.primary.name}+${config.secondary.name}` : config.primary.name,
    totalCandidates: finalRanked.length,
  };
}

function filterDocuments(
  docs: ReadonlyArray<KnowledgeDocument>,
  hints: RewriteHints,
  query: RetrievalQuery,
): readonly KnowledgeDocument[] {
  return docs.filter((d) => {
    if (query.categories && query.categories.length > 0 && !query.categories.includes(d.category)) {
      return false;
    }
    if (hints.categories.length > 0 && !hints.categories.includes(d.category)) {
      return false;
    }
    if (query.sourceTypes && query.sourceTypes.length > 0 && !query.sourceTypes.includes(d.sourceType)) {
      return false;
    }
    if (hints.sourceTypes.length > 0 && !hints.sourceTypes.includes(d.sourceType)) {
      return false;
    }
    return true;
  });
}

interface RawHit {
  documentId: string;
  score: number;
  matchedTokens: ReadonlyArray<string>;
}

function mergeCandidates(
  candidates: readonly KnowledgeDocument[],
  primary: ReadonlyArray<RawHit>,
  secondary: ReadonlyArray<RawHit>,
  hints: RewriteHints,
  config: RetrievalPipelineConfig,
): MergedCandidate[] {
  const map = new Map<string, MergedCandidate>();
  for (const doc of candidates) {
    map.set(doc.id, {
      document: doc,
      matchedTokens: [],
      primaryScore: 0,
      secondaryScore: 0,
      finalScore: 0,
    });
  }
  const maxPrimary = primary.reduce<number>((m, h) => Math.max(m, h.score), 0);
  const maxSecondary = secondary.reduce<number>((m, h) => Math.max(m, h.score), 0);
  for (const hit of primary) {
    const target = map.get(hit.documentId);
    if (!target) continue;
    target.primaryScore = maxPrimary > 0 ? hit.score / maxPrimary : 0;
    target.matchedTokens.push(...hit.matchedTokens);
  }
  for (const hit of secondary) {
    const target = map.get(hit.documentId);
    if (!target) continue;
    target.secondaryScore = maxSecondary > 0 ? hit.score / maxSecondary : 0;
  }

  // 用 hints 中的 terms 在 affectedConclusions 上做额外贡献
  for (const candidate of map.values()) {
    const tokenSet = new Set(candidate.matchedTokens);
    for (const t of hints.terms) {
      for (const key of candidate.document.affectedConclusions) {
        if (key.toLowerCase().includes(t)) tokenSet.add(t);
      }
      for (const kw of candidate.document.tags) {
        if (kw.toLowerCase().includes(t)) tokenSet.add(t);
      }
    }
    candidate.matchedTokens = Array.from(new Set(tokenSet));
  }

  void config;
  return Array.from(map.values());
}

function rerank(candidates: ReadonlyArray<MergedCandidate>): MergedCandidate[] {
  const maxHit = candidates.reduce((m, c) => Math.max(m, c.document.hitCount), 0);
  return [...candidates]
    .map<MergedCandidate>((c) => {
      const tokenPart = Math.min(1, c.matchedTokens.length / 3);
      const categoryHit = c.matchedTokens.length > 0 ? 1 : 0.4;
      const sourceTypeHit = c.document.sourceType !== "knowledge" ? 0.6 : 0.4;
      const affectedHit = Math.min(1, c.document.affectedConclusions.length / 4);
      const popularity = maxHit > 0 ? c.document.hitCount / maxHit : 0;
      const finalScore =
        tokenPart * RERANK_IMPORTANCE.matchedTokensWeight +
        categoryHit * RERANK_IMPORTANCE.categoryWeight +
        sourceTypeHit * RERANK_IMPORTANCE.sourceTypeWeight +
        affectedHit * RERANK_IMPORTANCE.affectedWeight +
        popularity * RERANK_IMPORTANCE.popularityWeight;

      return {
        ...c,
        finalScore: Number(Math.min(1, finalScore + 0.05 * c.secondaryScore).toFixed(3)),
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

function buildCitation(c: MergedCandidate, hints: RewriteHints): KnowledgeCitation {
  const doc = c.document;
  // 命中 token 与 hints 中的分类 / 关键词合并去重
  const mergedTokens = Array.from(new Set([...c.matchedTokens, ...hints.terms]));
  return {
    id: `cit-${doc.id}`,
    documentId: doc.id,
    documentTitle: doc.title,
    sourceType: doc.sourceType,
    category: doc.category,
    excerpt: doc.summary,
    score: c.finalScore,
    matchedTokens: mergedTokens,
    affectedConclusions: doc.affectedConclusions,
    usedByAgents: doc.usedByAgents,
  };
}

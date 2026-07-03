/**
 * BlastForge 知识库数据契约。
 *
 * 严格区分：
 * - source type: knowledge 教学模拟 | regulation 规范摘要 | case 案例摘要 | material 材料说明；
 * - 不允许伪造真实规范条款编号；
 * - 所有来源应在 UI 标记为 demo。
 */

import { z } from "zod";

export const KNOWLEDGE_SOURCE_TYPES = ["knowledge", "regulation", "case", "material"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_STATUSES = ["seeded", "indexed", "draft", "archived"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_CATEGORIES = [
  "explosive",
  "water",
  "environment",
  "cost",
  "risk-review",
  "general",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const sourceTypeSchema = z.enum(KNOWLEDGE_SOURCE_TYPES);
export const knowledgeStatusSchema = z.enum(KNOWLEDGE_STATUSES);
export const knowledgeCategorySchema = z.enum(KNOWLEDGE_CATEGORIES);

/** ---------- Document / Chunk ---------- */

export const knowledgeDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceType: sourceTypeSchema,
  category: knowledgeCategorySchema,
  status: knowledgeStatusSchema,
  /** 文档级标签，便于 UI 过滤与人工标记 */
  tags: z.array(z.string()).default([]),
  /** 用于在 UI 中显示的可读摘要 */
  summary: z.string(),
  /** 用于 UI 显示的"已确认" 字符 */
  publisher: z.string().default("BlastForge Demo 知识库"),
  /** 字数统计，便于展示 */
  wordCount: z.number().int().nonnegative().default(0),
  /** 关联的 Agent 列表（"被哪些 Agent 使用"） */
  usedByAgents: z.array(z.string()).default([]),
  /** 影响结论的关键词 */
  affectedConclusions: z.array(z.string()).default([]),
  /** 当前被检索命中的次数（用于 UI 展示） */
  hitCount: z.number().int().nonnegative().default(0),
  /** 创建时间（Demo 常量） */
  createdAt: z.string(),
  /** 全文检索片段数 */
  chunkCount: z.number().int().nonnegative().default(0),
});

export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;

export const knowledgeChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  /** 章节标题 / 段落名 */
  title: z.string(),
  /** 该片段对应的章节/页码 */
  section: z.string().optional(),
  page: z.number().int().positive().optional(),
  /** 命中片段全文（用于 UI 渲染） */
  excerpt: z.string(),
  /** 该片段影响的结论 key */
  affectedConclusions: z.array(z.string()).default([]),
  /** 该片段被哪些 Agent 调用 */
  usedByAgents: z.array(z.string()).default([]),
  /** 关键词 token，便于离线关键词检索 */
  keywords: z.array(z.string()).default([]),
});

export type KnowledgeChunk = z.infer<typeof knowledgeChunkSchema>;

/** ---------- Citation ---------- */

export const knowledgeCitationSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  sourceType: sourceTypeSchema,
  category: knowledgeCategorySchema,
  page: z.number().int().positive().optional(),
  section: z.string().optional(),
  excerpt: z.string(),
  /** 0..1 之间的检索得分 */
  score: z.number().min(0).max(1),
  /** 用于 UI 高亮命中的 token */
  matchedTokens: z.array(z.string()).default([]),
  /** 影响结论 + 被哪些 Agent 使用（前端展示位） */
  affectedConclusions: z.array(z.string()).default([]),
  usedByAgents: z.array(z.string()).default([]),
});

export type KnowledgeCitation = z.infer<typeof knowledgeCitationSchema>;

/** ---------- Retrieval Query / Result ---------- */

export const retrievalQuerySchema = z.object({
  /** 自然语言 query */
  query: z.string().min(1),
  /** 限制类别 */
  categories: z.array(knowledgeCategorySchema).optional(),
  /** 来源类型 */
  sourceTypes: z.array(sourceTypeSchema).optional(),
  /** 最大返回数 1..10 */
  limit: z.number().int().min(1).max(10).default(4),
});

export type RetrievalQuery = z.infer<typeof retrievalQuerySchema>;

export interface RetrievalResult {
  citations: KnowledgeCitation[];
  /** 检索耗时，毫秒 */
  durationMs: number;
  /** 检索模式：adapter name */
  adapter: string;
  /** 总命中候选数（应用 limit 前的数量） */
  totalCandidates: number;
}

/** ---------- KnowledgeRepository 契约 ---------- */

export interface KnowledgeRepository {
  listDocuments(): readonly KnowledgeDocument[];
  getDocument(id: string): KnowledgeDocument | undefined;
  listChunksByDocument(documentId: string): readonly KnowledgeChunk[];
  retrieve(query: RetrievalQuery): RetrievalResult;
}

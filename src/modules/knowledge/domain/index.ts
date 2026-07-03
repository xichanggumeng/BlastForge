/**
 * Knowledge Domain Index —— 仅类型与函数；不含服务端基础设施。
 */

export {
  type KnowledgeCategory,
  type KnowledgeDocument,
  type KnowledgeChunk,
  type KnowledgeCitation,
  type KnowledgeSourceType,
  type KnowledgeStatus,
  type RetrievalQuery,
  type RetrievalResult,
  type KnowledgeRepository,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_STATUSES,
} from "./contracts";

export {
  KeywordAdapter,
  VectorAdapter,
  type RetrievalAdapter,
  type RetrievalPipelineConfig,
  type RewriteHints,
  type MergedCandidate,
} from "./retrieval";

// 注意：getKnowledgeRepository 在服务端代码中按需从 "@/modules/knowledge/infrastructure/repository" 引入；
// 这里不再 re-export，避免 server-only 标记污染客户端 bundle。

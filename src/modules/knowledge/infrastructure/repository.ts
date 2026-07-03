/**
 * Knowledge Repository —— InMemory 默认实现。
 *
 * 启动时无需数据库；切换真实存储只需替换 adapter / repository，
 * 业务侧（Knowledge Page / RAG 调用方）继续使用统一接口。
 */

import "server-only";

import {
  SEED_DOCUMENTS,
  listChunksForDocument,
} from "../domain/seed-data";
import {
  retrieveWithPipeline,
  KeywordAdapter,
  type RetrievalAdapter,
} from "../domain/retrieval";
import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeRepository,
  RetrievalQuery,
  RetrievalResult,
} from "../domain/contracts";

class InMemoryKnowledgeRepository implements KnowledgeRepository {
  listDocuments(): readonly KnowledgeDocument[] {
    return SEED_DOCUMENTS;
  }

  getDocument(id: string): KnowledgeDocument | undefined {
    return SEED_DOCUMENTS.find((d) => d.id === id);
  }

  listChunksByDocument(documentId: string): readonly KnowledgeChunk[] {
    return listChunksForDocument(documentId);
  }

  retrieve(query: RetrievalQuery): RetrievalResult {
    return retrieveWithPipeline(query, {
      documents: SEED_DOCUMENTS,
      primary: this.primary,
    });
  }

  /** 默认使用关键词 Adapter；vector 服务可用时可注入 VectorAdapter。 */
  private primary: RetrievalAdapter = new KeywordAdapter();

  /** 内部方法：允许切换 Adapter（用于测试与高级 Demo 模式）。 */
  setPrimary(adapter: RetrievalAdapter): void {
    this.primary = adapter;
  }
}

let singleton: InMemoryKnowledgeRepository | null = null;

export function getKnowledgeRepository(): KnowledgeRepository {
  if (!singleton) singleton = new InMemoryKnowledgeRepository();
  return singleton;
}

/** 给测试 / 高级用法使用的 Repository 切换入口。 */
export function __resetKnowledgeRepositoryForTests(): void {
  singleton = null;
}

export type { KnowledgeRepository };

/**
 * Knowledge Repository 单元测试。
 */

import { describe, expect, it } from "vitest";

import { getKnowledgeRepository } from "@/modules/knowledge/infrastructure/repository";
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_SOURCE_TYPES } from "@/modules/knowledge/domain";

describe("InMemoryKnowledgeRepository", () => {
  it("listDocuments 返回种子文档", () => {
    const docs = getKnowledgeRepository().listDocuments();
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) {
      expect(KNOWLEDGE_CATEGORIES).toContain(d.category);
      expect(KNOWLEDGE_SOURCE_TYPES).toContain(d.sourceType);
    }
  });

  it("getDocument 按 id 命中", () => {
    const docs = getKnowledgeRepository().listDocuments();
    const target = docs[0]!;
    const found = getKnowledgeRepository().getDocument(target.id);
    expect(found?.id).toBe(target.id);
  });

  it("getDocument 找不到时返回 undefined", () => {
    expect(getKnowledgeRepository().getDocument("non-existent")).toBeUndefined();
  });

  it("listChunksByDocument 返回属于该文档的 chunk", () => {
    const docs = getKnowledgeRepository().listDocuments();
    const target = docs[0]!;
    const chunks = getKnowledgeRepository().listChunksByDocument(target.id);
    for (const c of chunks) {
      expect(c.documentId).toBe(target.id);
    }
  });

  it("retrieve 返回真实存在的知识片段，禁止编造", async () => {
    const result = await getKnowledgeRepository().retrieve({ query: "含水 抗水 振速", limit: 4 });
    expect(result.citations.length).toBeGreaterThan(0);
    // 每个 citation 必须对应一个文档 id
    const knownIds = new Set(getKnowledgeRepository().listDocuments().map((d) => d.id));
    for (const c of result.citations) {
      expect(knownIds.has(c.documentId)).toBe(true);
    }
  });

  it("retrieve 支持类别过滤", async () => {
    const result = await getKnowledgeRepository().retrieve({
      query: "案例 教学",
      limit: 8,
      categories: ["risk-review"],
    });
    for (const c of result.citations) {
      expect(c.category).toBe("risk-review");
    }
  });

  it("retrieve 支持来源过滤", async () => {
    const result = await getKnowledgeRepository().retrieve({
      query: "案例 摘要",
      limit: 8,
      sourceTypes: ["knowledge", "case"],
    });
    for (const c of result.citations) {
      expect(["knowledge", "case"]).toContain(c.sourceType);
    }
  });
});
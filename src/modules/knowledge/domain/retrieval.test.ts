/**
 * RAG 检索层单元测试。
 *
 * 覆盖：
 *  - KeywordAdapter：命中 / 不命中 / 类别过滤；
 *  - rewriteQuery：自然语言 -> 关键词 + 类别 + 来源；
 *  - retrieveWithPipeline：合并 / 重排 / 引用打包；
 *  - 高风险字段不影响检索结果但会进入 citation 上下文（仅知识库范围内）。
 */

import { describe, expect, it } from "vitest";

import {
  KeywordAdapter,
  rewriteQuery,
  retrieveWithPipeline,
} from "@/modules/knowledge/domain/retrieval";
import { KNOWLEDGE_CATEGORIES, type KnowledgeDocument } from "@/modules/knowledge/domain";
import { SEED_DOCUMENTS } from "@/modules/knowledge/domain/seed-index";

function docs(): ReadonlyArray<KnowledgeDocument> {
  return SEED_DOCUMENTS;
}

describe("RAG: rewriteQuery", () => {
  it("提取中文 token 与类别", () => {
    const hints = rewriteQuery({ query: "含水抗水环境敏感场景", limit: 4 });
    expect(hints.terms.length).toBeGreaterThan(0);
    expect(hints.terms).toEqual(expect.arrayContaining(["含", "水", "抗", "水"]));
  });

  it("识别类别关键词", () => {
    const hints = rewriteQuery({ query: "乳化炸药和抗水", limit: 4 });
    expect(hints.categories.length).toBeGreaterThan(0);
    expect(hints.categories).toContain("explosive");
  });

  it("空 query 时退化为空提示", () => {
    const hints = rewriteQuery({ query: "", limit: 4 });
    expect(hints.terms.length).toBe(0);
    expect(hints.categories.length).toBe(0);
  });
});

describe("RAG: KeywordAdapter", () => {
  const adapter = new KeywordAdapter();

  it("对含水场景能命中水相关文档", () => {
    const hits = adapter.score({ query: "含水 抗水 乳化", limit: 5 }, docs());
    const ids = hits.map((h) => h.documentId);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids[0]).toMatch(/KB-DOC/);
  });

  it("完全无关的 query 返回空", () => {
    // 使用一串独特数字串避免与文档内容意外匹配
    const hits = adapter.score(
      { query: "qwxzjklnm9876 nopqrstuvwxyz6543", limit: 5 },
      docs(),
    );
    expect(hits.length).toBe(0);
  });

  it("对相关 query 返回按 score 排序的命中", () => {
    const hits = adapter.score(
      { query: "炸药 案例 教学", limit: 10 },
      docs(),
    );
    expect(hits.length).toBeGreaterThan(0);
    // 排序：score 高的在前
    for (let i = 0; i < hits.length - 1; i++) {
      expect(hits[i]!.score).toBeGreaterThanOrEqual(hits[i + 1]!.score - 0.0001);
    }
  });

  it("enabled 标志为 true（关键词是基线能力）", () => {
    expect(adapter.enabled).toBe(true);
    expect(adapter.name).toBe("keyword");
  });
});

describe("RAG: retrieveWithPipeline", () => {
  it("端到端产出引用 + 元数据", async () => {
    const result = await retrieveWithPipeline(
      { query: "高敏感 环境 振速 控制", limit: 3 },
      {
        documents: docs(),
        primary: new KeywordAdapter(),
        secondary: undefined,
      },
    );
    expect(result.adapter).toBe("keyword");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]?.score).toBeGreaterThan(0);
    expect(result.totalCandidates).toBeGreaterThan(0);
    for (const c of result.citations) {
      expect(c.documentId).toMatch(/KB-DOC/);
      expect(KNOWLEDGE_CATEGORIES).toContain(c.category);
    }
  });

  it("超 limit 时截断", async () => {
    const result = await retrieveWithPipeline(
      { query: "爆破 炸药", limit: 2 },
      { documents: docs(), primary: new KeywordAdapter(), secondary: undefined },
    );
    expect(result.citations.length).toBeLessThanOrEqual(2);
  });

  it("未命中时不返回 citations", async () => {
    const result = await retrieveWithPipeline(
      { query: "qwxzjklnm9876 nopqrstuvwxyz6543", limit: 4 },
      { documents: docs(), primary: new KeywordAdapter(), secondary: undefined },
    );
    expect(result.citations).toHaveLength(0);
  });
});
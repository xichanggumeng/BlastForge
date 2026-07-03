/**
 * Route Handler: 检索知识库（Demo RAG）。
 *
 * GET /api/knowledge/retrieve?query=...&categories=...&sourceTypes=...&limit=...
 *
 * - 始终返回真实存在的知识片段，禁止模型编造；
 * - 未提供 API Key 时使用 KeywordAdapter；当 Embedding 服务未配置时
 *   自动回退到关键词 + 元数据过滤；
 * - 返回 KnowledgeCitation[] + 命中耗时 + 候选数。
 */

import { NextResponse, type NextRequest } from "next/server";

import { getKnowledgeRepository } from "@/modules/knowledge/infrastructure/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const categoriesParam = url.searchParams.get("categories");
  const sourceTypesParam = url.searchParams.get("sourceTypes");
  const limitRaw = url.searchParams.get("limit");

  const trimmed = query.trim();
  if (!trimmed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "MISSING_QUERY", message: "缺少 query 参数" },
        requestId: null,
      },
      { status: 400 },
    );
  }

  const limit = clampLimit(limitRaw);
  const categories = parseList(categoriesParam);
  const sourceTypes = parseList(sourceTypesParam);

  const repo = getKnowledgeRepository();
  const result = repo.retrieve({
    query: trimmed,
    limit,
    ...(categories.length > 0 ? { categories: categories as never[] } : {}),
    ...(sourceTypes.length > 0 ? { sourceTypes: sourceTypes as never[] } : {}),
  });

  return NextResponse.json({ success: true, data: result, requestId: null });
}

function clampLimit(raw: string | null): number {
  if (!raw) return 4;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 4;
  return Math.max(1, Math.min(10, n));
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Knowledge Retrieval Studio —— RAG 检索测试客户端。
 *
 * - 在 Knowledge 页面内提供检索入口；
 * - 调用 /api/knowledge/retrieve 实时获取 Citation；
 * - 展示命中片段 / 来源 / 类别 / 影响结论 / 使用的 Agent；
 * - UI 中允许的查询状态：empty / running / success / error。
 */

"use client";

import { useCallback, useState } from "react";
import { Loader2, RotateCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import { CitationPanel } from "@/components/citations/citation-panel";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_SOURCE_TYPES,
  type KnowledgeCategory,
  type KnowledgeCitation,
  type KnowledgeSourceType,
  type RetrievalResult,
} from "@/modules/knowledge/domain";

const CATEGORY_LABEL: Record<KnowledgeCategory, string> = {
  explosive: "炸药类型",
  water: "含水场景",
  environment: "环境敏感",
  cost: "成本与便利",
  "risk-review": "风险复核",
  general: "通用教学",
};

const SOURCE_TYPE_LABEL: Record<KnowledgeSourceType, string> = {
  knowledge: "教学摘要",
  regulation: "规范摘要",
  case: "教学案例",
  material: "材料",
};

const SAMPLE_QUERIES: ReadonlyArray<{ label: string; query: string; categories: KnowledgeCategory[]; sourceTypes: KnowledgeSourceType[] }> = [
  {
    label: "含水炮孔装药",
    query: "含水炮孔 抗水炸药 不耦合装药",
    categories: ["water"],
    sourceTypes: ["knowledge"],
  },
  {
    label: "敏感环境振速",
    query: "敏感环境 允许振速 医院 试爆",
    categories: ["environment"],
    sourceTypes: ["regulation", "case"],
  },
  {
    label: "成本权衡",
    query: "成本 严格 经济备选 安全性",
    categories: ["cost"],
    sourceTypes: ["knowledge"],
  },
  {
    label: "风险复核",
    query: "Safety Reviewer 阻断 高敏感 飞石",
    categories: ["risk-review"],
    sourceTypes: ["knowledge"],
  },
];

type Status = "idle" | "running" | "success" | "error";

interface RetrievalStudioState {
  query: string;
  status: Status;
  result: RetrievalResult | null;
  error: string | null;
  categories: KnowledgeCategory[];
  sourceTypes: KnowledgeSourceType[];
  limit: number;
}

export function KnowledgeRetrievalStudio({
  initialResult,
}: {
  initialResult?: RetrievalResult | null;
}) {
  const [state, setState] = useState<RetrievalStudioState>({
    query: "",
    status: "idle",
    result: initialResult ?? null,
    error: null,
    categories: [],
    sourceTypes: [],
    limit: 4,
  });

  const runQuery = useCallback(
    async (
      overrides: Partial<Pick<RetrievalStudioState, "query" | "categories" | "sourceTypes" | "limit">>,
    ) => {
      const nextQuery = overrides.query ?? state.query;
      const nextCategories = overrides.categories ?? state.categories;
      const nextSourceTypes = overrides.sourceTypes ?? state.sourceTypes;
      const nextLimit = overrides.limit ?? state.limit;

      if (!nextQuery.trim()) {
        setState((prev) => ({ ...prev, status: "idle", error: null, result: null }));
        return;
      }

      setState((prev) => ({
        ...prev,
        query: nextQuery,
        categories: nextCategories,
        sourceTypes: nextSourceTypes,
        limit: nextLimit,
        status: "running",
        error: null,
      }));

      try {
        const params = new URLSearchParams();
        params.set("query", nextQuery);
        if (nextCategories.length > 0) params.set("categories", nextCategories.join(","));
        if (nextSourceTypes.length > 0) params.set("sourceTypes", nextSourceTypes.join(","));
        params.set("limit", String(nextLimit));

        const res = await fetch(`/api/knowledge/retrieve?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as
          | { success: true; data: RetrievalResult }
          | { success: false; error: { code: string; message: string } };

        if (!json.success) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: json.error.message,
            result: null,
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          status: "success",
          result: json.data,
          error: null,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "请求失败",
          result: null,
        }));
      }
    },
    [state.query, state.categories, state.sourceTypes, state.limit],
  );

  const isRunning = state.status === "running";
  const citations: KnowledgeCitation[] = state.result?.citations ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md" tone="default">
        <CardContent>
          <div className="flex flex-col gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runQuery({});
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <span
                aria-hidden
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground"
              >
                <Search className="h-4 w-4" />
              </span>
              <input
                type="search"
                value={state.query}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, query: e.target.value, status: prev.status === "running" ? prev.status : "idle" }))
                }
                placeholder="试试搜索：含水炮孔、敏感环境、成本权衡、风险复核…"
                aria-label="知识检索 Query"
                className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button variant="primary" type="submit" loading={isRunning} disabled={!state.query.trim()}>
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> 检索中
                  </>
                ) : (
                  "检索"
                )}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    query: "",
                    categories: [],
                    sourceTypes: [],
                    status: "idle",
                    result: null,
                    error: null,
                  }));
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> 清空
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">类别：</span>
              {KNOWLEDGE_CATEGORIES.map((c) => {
                const active = state.categories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        categories: active
                          ? prev.categories.filter((x) => x !== c)
                          : [...prev.categories, c],
                      }))
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/30",
                    )}
                    aria-pressed={active}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">来源：</span>
              {KNOWLEDGE_SOURCE_TYPES.map((s) => {
                const active = state.sourceTypes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        sourceTypes: active
                          ? prev.sourceTypes.filter((x) => x !== s)
                          : [...prev.sourceTypes, s],
                      }))
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border text-muted-foreground hover:bg-muted/30",
                    )}
                    aria-pressed={active}
                  >
                    {SOURCE_TYPE_LABEL[s]}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">一键示例：</span>
              {SAMPLE_QUERIES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() =>
                    void runQuery({
                      query: s.query,
                      categories: s.categories,
                      sourceTypes: s.sourceTypes,
                    })
                  }
                  className="rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {state.status === "error" ? (
        <Card tone="elevated" padding="md">
          <CardContent>
            <p className="text-sm text-danger">检索失败：{state.error ?? "未知错误"}</p>
          </CardContent>
        </Card>
      ) : null}

      {state.result ? (
        <Card tone="muted" padding="md">
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge tone="primary" size="sm">
                Adapter：{state.result.adapter}
              </Badge>
              <Badge tone="outline" size="sm">
                候选 {state.result.totalCandidates}
              </Badge>
              <Badge tone="outline" size="sm">
                耗时 {state.result.durationMs} ms
              </Badge>
              <Badge tone="outline" size="sm">
                返回 {citations.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CitationPanel
        citations={citations}
        title={state.status === "idle" ? "等待首次检索" : "检索结果"}
        emptyHint={
          state.status === "idle"
            ? "在上方输入 query 或选择一键示例开始检索。"
            : "当前查询未命中任何片段；请尝试更换关键词或放宽类别筛选。"
        }
        key={state.result ? JSON.stringify(citations.map((c) => c.id)) : state.status}
      />
    </div>
  );
}

/**
 * 知识库页面。
 *
 * 内容：
 * - 顶部摘要：文档数 / 来源类型分布 / 类别分布 / 已检索命中数；
 * - 检索测试：客户端 Studio；
 * - 文档列表 + 分类 + 状态 + 片段数；
 * - 命中片段预览（默认展示前 3 个 chunk）；
 * - 文档级 "usedByAgents" / "affectedConclusions" 可视化。
 */

import { BookOpen, FileText, ListTree, Users } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";

import { KnowledgeRetrievalStudio } from "@/components/knowledge/knowledge-retrieval-studio";
import { getKnowledgeRepository } from "@/modules/knowledge/infrastructure/repository";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_SOURCE_TYPES,
  type KnowledgeCategory,
  type KnowledgeDocument,
  type KnowledgeSourceType,
} from "@/modules/knowledge/domain";
import { SEED_CHUNKS } from "@/modules/knowledge/domain/seed-index";

export const metadata = {
  title: "知识库",
};

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

export default function KnowledgePage() {
  const repo = getKnowledgeRepository();
  const documents = repo.listDocuments();
  const totalHits = documents.reduce<number>((sum, d) => sum + d.hitCount, 0);
  const totalChunks = documents.reduce<number>((sum, d) => sum + d.chunkCount, 0);

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Knowledge Base"
        title="知识库"
        description="教学 / 规范摘要 / 案例 / 材料四类来源；脱敏标识，不得作为正式规范条款。"
        icon={BookOpen}
        meta={
          <>
            <Badge tone="primary">RAG · Adapter</Badge>
            <Badge tone="outline">{documents.length} docs</Badge>
            <Badge tone="outline">{totalChunks} chunks</Badge>
            <Badge tone="outline">{totalHits} hits</Badge>
          </>
        }
      />

      <section className="flex flex-col gap-3" aria-labelledby="knowledge-distribution">
        <SectionHeader
          title="知识覆盖与分布"
          description="按类别 / 来源类型聚合，确保五类主题（炸药 / 含水 / 环境 / 成本 / 风险复核）都有明确来源。"
        />
        <WorkspaceGrid columns={2}>
          <DistributionCard title="按类别" data={countByCategory(documents)} labels={CATEGORY_LABEL} />
          <DistributionCard
            title="按来源"
            data={countBySourceType(documents)}
            labels={SOURCE_TYPE_LABEL}
          />
        </WorkspaceGrid>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="knowledge-retrieval-test">
        <SectionHeader
          title="检索测试"
          description="输入自然语言 Query，按类别 / 来源类型过滤；命中片段会真实返回知识库中的内容。"
        />
        <KnowledgeRetrievalStudio initialResult={null} />
      </section>

      <section aria-labelledby="knowledge-docs" className="flex flex-col gap-4">
        <SectionHeader
          title="知识文档"
          description="全部文档均为脱敏教学 / 模拟来源；任何现场决策必须以现行规范与具备资质人员的签字为准。"
        />
        {documents.length === 0 ? (
          <EmptyState
            title="暂无知识文档"
            description="请等待 RAG 种子数据加载。"
            icon={FileText}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        )}
      </section>
    </WorkspacePage>
  );
}

function DistributionCard<K extends string>({
  title,
  data,
  labels,
}: {
  title: string;
  data: Record<K, number>;
  labels: Record<K, string>;
}) {
  const total = (Object.values(data) as number[]).reduce<number>((s, n) => s + n, 0);
  return (
    <Card tone="default" padding="md">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>共 {total} 项；分桶计数用于 Demo 演示。</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {Object.keys(data).map((k) => {
            const key = k as K;
            const value = data[key];
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <li key={k} className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0 truncate text-muted-foreground">
                  {labels[key] ?? k}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full bg-primary/60"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                </div>
                <span className="w-12 shrink-0 text-right tabular text-foreground">
                  {value} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function countByCategory(docs: ReadonlyArray<{ category: KnowledgeCategory }>): Record<KnowledgeCategory, number> {
  const out = {} as Record<KnowledgeCategory, number>;
  for (const c of KNOWLEDGE_CATEGORIES) out[c] = 0;
  for (const d of docs) {
    out[d.category] = (out[d.category] ?? 0) + 1;
  }
  return out;
}

function countBySourceType(
  docs: ReadonlyArray<{ sourceType: KnowledgeSourceType }>,
): Record<KnowledgeSourceType, number> {
  const out = {} as Record<KnowledgeSourceType, number>;
  for (const s of KNOWLEDGE_SOURCE_TYPES) out[s] = 0;
  for (const d of docs) {
    out[d.sourceType] = (out[d.sourceType] ?? 0) + 1;
  }
  return out;
}

function DocumentCard({ document: doc }: { document: KnowledgeDocument }) {
  const chunks = SEED_CHUNKS.filter((c) => c.documentId === doc.id).slice(0, 3);
  const moreChunks = doc.chunkCount - chunks.length;
  return (
    <Card tone="elevated" padding="lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <CardTitle className="text-base">{doc.title}</CardTitle>
            <CardDescription>{doc.publisher}</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge tone="primary" size="sm">{CATEGORY_LABEL[doc.category]}</Badge>
            <Badge tone="outline" size="sm">{SOURCE_TYPE_LABEL[doc.sourceType]}</Badge>
            <Badge tone="success" size="sm">{doc.status}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{doc.summary}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">{doc.id}</Badge>
            <Badge tone="outline" size="sm">{doc.chunkCount} chunks</Badge>
            <Badge tone="outline" size="sm">{doc.wordCount} 字</Badge>
            <Badge tone="outline" size="sm">{doc.hitCount} hits</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">
              <Users className="mr-1 inline h-3 w-3" aria-hidden />
              关联 Agent：
            </span>
            {doc.usedByAgents.map((a) => (
              <Badge key={a} tone="accent" size="sm">{a}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">
              <ListTree className="mr-1 inline h-3 w-3" aria-hidden />
              影响结论：
            </span>
            {doc.affectedConclusions.map((c) => (
              <Badge key={c} tone="warning" size="sm">{c}</Badge>
            ))}
          </div>
          {chunks.length > 0 ? (
            <details className="rounded-md border border-border bg-muted/30 p-2" open>
              <summary className="cursor-pointer text-[11px] text-muted-foreground">
                <FileText className="mr-1 inline h-3 w-3" aria-hidden /> 命中片段预览
                {moreChunks > 0 ? `（展示前 ${chunks.length} 条 / 共 ${doc.chunkCount}）` : ""}
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {chunks.map((c) => (
                  <li key={c.id} className="rounded-md border border-border bg-surface p-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{c.section ?? c.title}</span>
                      {c.page ? <span>第 {c.page} 页</span> : null}
                    </div>
                    <p className="mt-1 text-foreground">{c.excerpt}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

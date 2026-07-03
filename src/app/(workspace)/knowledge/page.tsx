import { BookOpen, Files, Search } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";
import { EmptyState } from "@/components/feedback/empty-state";

import { loadKnowledgeDocs } from "@/server/demo/loaders";

export const metadata = {
  title: "知识库",
};

export default function KnowledgePage() {
  const docs = loadKnowledgeDocs();

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Knowledge"
        title="知识库"
        description="Phase 1 展示 Demo 预设的 4 份脱敏知识片段。Phase 4 接入 pgvector 后将提供完整检索、引用关系与命中率统计。"
        icon={BookOpen}
        meta={
          <>
            <Badge tone="primary">pgvector · Phase 4</Badge>
            <Badge tone="outline">{docs.length} docs</Badge>
          </>
        }
      />

      <section
        aria-labelledby="knowledge-search"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="知识检索（占位）"
          description="Phase 4 启用后支持关键词 + 向量 + 元数据过滤的混合检索。"
        />
        <Card tone="muted" padding="md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground"
            >
              <Search className="h-4 w-4" />
            </span>
            <input
              type="search"
              disabled
              placeholder="Phase 4 开放检索"
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"
              aria-label="知识检索"
            />
            <Badge tone="outline">Phase 4</Badge>
          </div>
        </Card>
      </section>

      <section aria-labelledby="knowledge-docs" className="flex flex-col gap-4">
        <SectionHeader
          title="脱敏知识片段"
          description="节选自 Demo 预设的教学材料与规范摘要，用于演示引用关系。"
        />
        {docs.length === 0 ? (
          <EmptyState
            title="暂无知识文档"
            description="请等待 Phase 4 接入 RAG 检索。"
            icon={Files}
          />
        ) : (
          <WorkspaceGrid columns={2}>
            {docs.map((doc) => (
              <Card key={doc.id} tone="elevated" padding="lg">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{doc.title}</CardTitle>
                    <Badge tone="outline">{doc.category}</Badge>
                  </div>
                  <CardDescription>
                    {doc.page ? `第 ${doc.page} 页` : "未指定页码"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{doc.excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </WorkspaceGrid>
        )}
      </section>
    </WorkspacePage>
  );
}
import { FileText, ScrollText, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";
import { EmptyState } from "@/components/feedback/empty-state";

import { loadReports } from "@/server/demo/loaders";
import { formatDateTime } from "@/lib/format";

export const metadata = {
  title: "报告中心",
};

const STATUS_TONE: Record<
  "draft" | "pending-review" | "approved" | "archived",
  "neutral" | "warning" | "success" | "outline"
> = {
  draft: "neutral",
  "pending-review": "warning",
  approved: "success",
  archived: "outline",
};

const STATUS_LABEL: Record<"draft" | "pending-review" | "approved" | "archived", string> = {
  draft: "草稿",
  "pending-review": "待复核",
  approved: "已批准",
  archived: "已归档",
};

export default function ReportsPage() {
  const reports = loadReports();

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Report Center"
        title="报告中心"
        description="结构化报告与归档。Phase 1 展示 3 份 Demo 预设报告，Phase 5 启用真实报告生成、导出与预录制 Run 回放。"
        icon={FileText}
        meta={
          <>
            <Badge tone="primary">Phase 5 · 导出</Badge>
            <Badge tone="outline">{reports.length} reports</Badge>
          </>
        }
        actions={
          <Button variant="primary" disabled>
            <Sparkles className="h-4 w-4" />
            生成新报告（Phase 5 开放）
          </Button>
        }
      />

      <section
        aria-labelledby="reports-summary"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="报告能力预览"
          description="下一阶段将提供以下能力，所有页面均使用本 Shell 复用。"
        />
        <WorkspaceGrid columns={3}>
          <PreviewCard
            icon={ScrollText}
            title="报告模板"
            description="工程条件、参数规划、方案对比、风险清单、知识引用、Agent 摘要。"
          />
          <PreviewCard
            icon={FileText}
            title="预览与导出"
            description="支持 PDF / Markdown 导出，保留责任边界说明。"
          />
          <PreviewCard
            icon={Sparkles}
            title="演示回放"
            description="模型不可用时切换预录制 Run，必须明确标识为回放模式。"
          />
        </WorkspaceGrid>
      </section>

      <section aria-labelledby="reports-list" className="flex flex-col gap-4">
        <SectionHeader title="Demo 报告" description="由 Report Agent 生成的示例报告。" />
        {reports.length === 0 ? (
          <EmptyState
            title="暂无报告"
            description="请等待 Phase 5 接入报告生成。"
            icon={FileText}
          />
        ) : (
          <WorkspaceGrid columns={2}>
            {reports.map((report) => (
              <Card key={report.id} tone="elevated" padding="lg">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <Badge tone={STATUS_TONE[report.status]}>
                      {STATUS_LABEL[report.status]}
                    </Badge>
                  </div>
                  <CardDescription>
                    {report.size} · {formatDateTime(report.updatedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" disabled>
                      预览
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      下载（Phase 5）
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </WorkspaceGrid>
        )}
      </section>
    </WorkspacePage>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card tone="elevated" padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent"
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge tone="outline">Phase 5</Badge>
      </CardContent>
    </Card>
  );
}
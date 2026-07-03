import { FileText, ScrollText, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";
import { EmptyState } from "@/components/feedback/empty-state";

import { ReportList } from "@/components/reports/report-list";

import { getReportRepository } from "@/modules/report/infrastructure/repository";
import { formatDateTime } from "@/lib/format";

export const metadata = {
  title: "报告中心",
};

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const reports = getReportRepository().list(20);
  const preset = [
    {
      id: "preset-normal",
      label: "常规露天深孔",
      scenario: "open-pit-bench / medium rock",
      description: "复用 DeepSeek / 回放 Run 均可生成完整报告。",
    },
    {
      id: "preset-complex",
      label: "复杂周边城市",
      scenario: "open-pit-bench · environment-sensitivity=medium",
      description: "引入城镇保护对象、振速约束、多方案对比。",
    },
    {
      id: "preset-risk",
      label: "高敏感场景",
      scenario: "environment-sensitivity=high",
      description: "高风险阻断；必须由 Safety Officer 签字后才能生成最终报告。",
    },
  ];

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Report Center"
        title="报告中心"
        description="同一 Planning Run 的全量结构化报告；包含封面、原始输入、标准化参数、推荐 / 备选 / 风险方案、评分、风险清单、知识引用、人工复核与责任边界。"
        icon={FileText}
        meta={
          <>
            <Badge tone="primary">Phase 5 · 导出</Badge>
            <Badge tone="outline">{reports.length} reports</Badge>
          </>
        }
      />

      <section
        aria-labelledby="reports-presets"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="演示预设"
          description="三个预设场景；任意 Run 完成后可立即生成报告。"
        />
        <WorkspaceGrid columns={3}>
          {preset.map((p) => (
            <Card key={p.id} tone="elevated" padding="lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <Badge tone="primary" size="sm">
                    preset
                  </Badge>
                </div>
                <CardDescription>{p.scenario}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </CardContent>
            </Card>
          ))}
        </WorkspaceGrid>
      </section>

      <section
        aria-labelledby="reports-capability"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="报告能力"
          description="所有页面均使用本 Shell 复用。"
        />
        <WorkspaceGrid columns={3}>
          <PreviewCard
            icon={ScrollText}
            title="结构化章节"
            description="封面 / 摘要 / 标准化 / 规则 / 方案 / 评分 / 风险 / 引用 / 复核 / 责任边界。"
          />
          <PreviewCard
            icon={FileText}
            title="打印 / PDF"
            description="内置浏览器原生打印样式；不依赖高风险服务端浏览器。"
          />
          <PreviewCard
            icon={Sparkles}
            title="多格式导出"
            description="支持 Markdown / JSON / HTML；满足二次处理与归档需求。"
          />
        </WorkspaceGrid>
      </section>

      <section aria-labelledby="reports-list" className="flex flex-col gap-4">
        <SectionHeader
          title="已生成报告"
          description="按更新时间倒序；支持预览、打印 / PDF、Markdown / JSON 下载。"
        />
        {reports.length === 0 ? (
          <EmptyState
            title="尚无报告"
            description="前往 Planner 启动一次 Workflow，完成后回此处即可生成报告。"
            icon={FileText}
          />
        ) : (
          <ReportList reports={reports} />
        )}
        <p className="text-[11px] text-muted-foreground">
          最近一次报告刷新：{formatDateTime(new Date().toISOString())} · 当前 Demo 数据库默认内存存储。
        </p>
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
    </Card>
  );
}
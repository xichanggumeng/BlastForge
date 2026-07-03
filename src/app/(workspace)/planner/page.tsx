import { SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import {
  ModulePreviewCard,
} from "@/components/layout/module-preview-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { RiskBadge } from "@/components/feedback/risk-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ListChecks, Loader2, ShieldAlert, Sparkles } from "lucide-react";

import { loadProjects } from "@/server/demo/loaders";
import { formatDateTime } from "@/lib/format";

export const metadata = {
  title: "参数规划",
};

export default function PlannerPage() {
  const projects = loadProjects();
  const current = projects[0];

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Phase 2 预告"
        title="参数规划工作台"
        description="录入工程条件、启动 Agentic Workflow 并查看多方案对比。Phase 1 阶段呈现占位内容，下一阶段接入真实表单与 DeepSeek Provider。"
        icon={SlidersHorizontal}
        meta={
          <>
            <Badge tone="outline">等待 Phase 2</Badge>
            <Badge tone="primary">deepseek-v4-pro</Badge>
          </>
        }
        actions={
          <Button variant="primary" disabled>
            <Sparkles className="h-4 w-4" />
            启动规划（Phase 2 开放）
          </Button>
        }
      />

      <section
        aria-labelledby="planner-current"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="当前默认工程"
          description="Demo 默认载入 RockHill 露天台阶爆破项目，下一阶段允许选择其他场景。"
        />
        {current ? (
          <Card tone="elevated" padding="lg">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <CardTitle>{current.name}</CardTitle>
                  <CardDescription>{current.site}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={current.status} />
                  <RiskBadge level={current.risk} />
                </div>
              </div>
            </CardHeader>
            <CardDescription>{current.summary}</CardDescription>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <PreviewStat label="工程类型" value="露天深孔台阶" />
              <PreviewStat label="岩石类别" value="中硬岩 · f=8" />
              <PreviewStat label="最近更新" value={formatDateTime(current.updatedAt)} />
            </div>
          </Card>
        ) : (
          <EmptyState
            title="暂未载入项目"
            description="请等待 Phase 2 接入 Demo 预设场景选择器。"
            icon={Loader2}
          />
        )}
      </section>

      <section
        aria-labelledby="planner-preview"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="Phase 2 模块预览"
          description="下一阶段将启用以下能力，所有页面均会复用本工作台 Shell。"
        />
        <WorkspaceGrid columns={3}>
          <ModulePreviewCard
            title="工程条件录入"
            description="表单 + 自然语言补充；支持场景模板与历史项目继承。"
            icon={ListChecks}
            tone="primary"
            badge="Phase 2"
            bullets={["结构化参数 Schema", "单位自动归一", "缺失参数提示"]}
          />
          <ModulePreviewCard
            title="参数规划结果"
            description="推荐 / 备选 / 风险方案并列展示，雷达图 + 柱状图联动。"
            icon={SlidersHorizontal}
            tone="accent"
            badge="Phase 2"
            bullets={["区间与置信标识", "参数敏感性", "知识依据引用"]}
          />
          <ModulePreviewCard
            title="人工复核节点"
            description="Safety Reviewer 阻断时进入人工确认，必要时回退到 Phase 1 录入。"
            icon={ShieldAlert}
            tone="neutral"
            badge="Phase 2"
            bullets={["重点确认清单", "修改轨迹", "审批记录"]}
          />
        </WorkspaceGrid>
      </section>
    </WorkspacePage>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
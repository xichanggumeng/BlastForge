import { Workflow } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";
import { cn } from "@/lib/cn";

import { loadWorkflowSteps } from "@/server/demo/loaders";

export const metadata = {
  title: "Workflow",
};

export default function WorkflowPage() {
  const steps = loadWorkflowSteps();

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Agentic Workflow"
        title="Workflow 执行视图"
        description="Phase 1 展示主 Workflow 节点定义与状态。Phase 3 将通过 React Flow 渲染真实执行流并以流式事件更新节点状态。"
        icon={Workflow}
        meta={
          <>
            <Badge tone="primary">主 Workflow</Badge>
            <Badge tone="outline">{steps.length} steps</Badge>
          </>
        }
      />

      <section aria-labelledby="workflow-stages" className="flex flex-col gap-4">
        <SectionHeader
          title="执行节点"
          description="按设计规范 §15.1 定义，节点顺序固定；高风险步骤必须经过 Safety Reviewer。"
        />
        <ol className="flex flex-col gap-3">
          {steps.map((step, idx) => (
            <li key={step.id}>
              <Card
                tone={step.status === "running" ? "elevated" : "default"}
                padding="md"
                className={cn(
                  "border-l-2",
                  step.status === "running"
                    ? "border-l-primary"
                    : step.status === "succeeded"
                      ? "border-l-success"
                      : step.status === "blocked" || step.status === "failed"
                        ? "border-l-danger"
                        : "border-l-border",
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-1 items-start gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-xs font-mono text-muted-foreground"
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-sm">{step.label}</CardTitle>
                        {step.requiresApproval ? (
                          <Badge tone="warning">需要人工确认</Badge>
                        ) : null}
                      </div>
                      <CardDescription>{step.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="outline" className="font-mono text-[11px]">
                      {step.agentId}
                    </Badge>
                    <StatusBadge status={step.status} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="workflow-preview" className="flex flex-col gap-4">
        <SectionHeader
          title="Phase 3 增强"
          description="下一阶段使用 React Flow 渲染可拖拽节点、连线与数据流；当前为静态演示。"
        />
        <WorkspaceGrid columns={3}>
          {[
            {
              key: "reactflow",
              title: "React Flow 节点图",
              description: "节点脉冲动画、数据流连线、状态分色。",
            },
            {
              key: "events",
              title: "事件流更新",
              description: "订阅 workflow.* / agent.* / tool.* 事件增量更新。",
            },
            {
              key: "trace",
              title: "Trace Recorder",
              description: "每个节点展开查看耗时、引用、输入输出摘要。",
            },
          ].map((item) => (
            <Card key={item.key} tone="default" padding="md">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge tone="outline">Phase 3</Badge>
              </CardContent>
            </Card>
          ))}
        </WorkspaceGrid>
      </section>
    </WorkspacePage>
  );
}
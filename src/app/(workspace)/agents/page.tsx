import { Bot, Cpu, Wrench } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";

import { loadAgents } from "@/server/demo/loaders";

export const metadata = {
  title: "Agent 工作台",
};

export default function AgentsPage() {
  const agents = loadAgents();

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Agent Pool"
        title="Agent 工作台"
        description="8 个专业 Agent 组成 BlastForge Agent Runtime。Phase 1 展示 Agent 身份、工具与版本，下一阶段接入实际 Provider 与 Trace。"
        icon={Bot}
        meta={
          <>
            <Badge tone="primary">deepseek-v4-pro</Badge>
            <Badge tone="outline">{agents.length} agents</Badge>
          </>
        }
      />

      <section aria-labelledby="agents-summary" className="flex flex-col gap-4">
        <SectionHeader
          title="能力分布"
          description="按 Agent 职责快速识别负责规划、检索、评分或复核的角色。"
        />
        <WorkspaceGrid columns={3}>
          <SummaryCard
            icon={Cpu}
            label="规划类 Agent"
            value="3"
            hint="Supervisor / Planner / Generator"
            tone="primary"
          />
          <SummaryCard
            icon={Wrench}
            label="工具调用 Agent"
            value="4"
            hint="Retriever / Evaluator / Safety / Report"
            tone="accent"
          />
          <SummaryCard
            icon={Bot}
            label="在线 Agent"
            value={String(agents.filter((a) => a.status !== "offline").length)}
            hint="Phase 1 全部就绪"
            tone="success"
          />
        </WorkspaceGrid>
      </section>

      <section aria-labelledby="agents-list" className="flex flex-col gap-4">
        <SectionHeader
          title="Agent 池"
          description="点击任意 Agent 在 Phase 3 可查看 Schema、最近任务与工具调用记录。"
        />
        <WorkspaceGrid columns={2}>
          {agents.map((agent) => (
            <Card key={agent.id} tone="elevated" padding="lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle>{agent.name}</CardTitle>
                    <CardDescription>{agent.role}</CardDescription>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone="outline">{agent.model}</Badge>
                  <Badge tone={agent.mode === "thinking" ? "primary" : "accent"}>
                    {agent.mode}
                  </Badge>
                  <Badge tone="neutral">v{agent.version}</Badge>
                </div>
                <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <span className="uppercase tracking-[0.18em]">Tools</span>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.tools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </WorkspaceGrid>
      </section>
    </WorkspacePage>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "accent" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/40 text-primary"
      : tone === "accent"
        ? "border-accent/40 text-accent"
        : "border-success/40 text-success";
  return (
    <Card tone="elevated" padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <span
            aria-hidden
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-surface ${toneClass}`}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <span className="tabular text-2xl font-semibold text-foreground">
          {value}
        </span>
      </CardHeader>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}
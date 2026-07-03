import { Activity, AlertTriangle, BookOpen, Cpu, GaugeCircle } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { MetricCard } from "@/components/feedback/metric-card";
import { SectionHeader } from "@/components/feedback/section-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { RiskBadge } from "@/components/feedback/risk-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";
import { formatDateTime } from "@/lib/format";
import { loadDashboardMetrics, loadProjects } from "@/server/demo/loaders";

export const metadata = {
  title: "总览",
};

const ICONS = {
  "active-projects": BookOpen,
  "running-agents": Cpu,
  "open-risks": AlertTriangle,
  "knowledge-citations": GaugeCircle,
} as const;

export default function DashboardPage() {
  const metrics = loadDashboardMetrics();
  const projects = loadProjects();

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="智能驾驶舱"
        title="项目、Agent 与风险全景"
        description="Phase 1 阶段呈现当前 Demo 预设项目的运行状态、Agent 池能力与待处理风险。下个阶段将接入实时 Run 与知识引用。"
        icon={Activity}
        meta={
          <>
            <StatusBadge status="running" />
            <span className="text-xs text-muted-foreground">
              最近更新 · {formatDateTime(projects[0]?.updatedAt)}
            </span>
          </>
        }
      />

      <section
        aria-labelledby="dashboard-metrics"
        className="flex flex-col gap-3"
      >
        <h2 id="dashboard-metrics" className="sr-only">
          关键指标
        </h2>
        <WorkspaceGrid columns={4}>
          {metrics.map((metric) => {
            const Icon = ICONS[metric.key as keyof typeof ICONS];
            return (
              <MetricCard
                key={metric.key}
                label={metric.label}
                value={metric.value}
                delta={metric.delta}
                hint={metric.hint}
                icon={Icon}
                tone={metric.tone ?? "neutral"}
              />
            );
          })}
        </WorkspaceGrid>
      </section>

      <section aria-labelledby="dashboard-projects" className="flex flex-col gap-4">
        <SectionHeader
          title="预设项目"
          description="Demo 默认装载的 3 个工程场景，覆盖常规、复杂与高风险三类。"
        />
        <WorkspaceGrid columns={3}>
          {projects.map((project) => (
            <Card key={project.id} tone="elevated" padding="lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{project.name}</CardTitle>
                  <RiskBadge level={project.risk} />
                </div>
                <CardDescription>{project.site}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{project.summary}</p>
                <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>运行进度</span>
                    <span className="tabular text-foreground">
                      {Math.round(project.progress * 100)}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(project.progress * 100)}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.round(project.progress * 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <StatusBadge status={project.status} />
                <span>{formatDateTime(project.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </WorkspaceGrid>
      </section>
    </WorkspacePage>
  );
}
import { Activity, AlertTriangle, BookOpen, Cpu, GaugeCircle } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { MetricCard } from "@/components/feedback/metric-card";
import { SectionHeader } from "@/components/feedback/section-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { WorkspaceGrid, WorkspacePage } from "@/components/layout/workspace-page";
import {
  AgentStageChart,
  RiskDistributionChart,
  TaskTrendChart,
} from "@/components/dashboard/charts/dashboard-charts";
import { DashboardAgentActivityPanel } from "@/components/dashboard/dashboard-agent-activity";
import { DashboardCurrentProject } from "@/components/dashboard/dashboard-current-project";
import { DashboardKnowledgeStrip } from "@/components/dashboard/dashboard-knowledge-strip";
import { DashboardPendingReview } from "@/components/dashboard/dashboard-pending-review";
import { DashboardRecentReports } from "@/components/dashboard/dashboard-recent-reports";
import { DashboardRecentTasks } from "@/components/dashboard/dashboard-recent-tasks";
import { DashboardRiskAlerts } from "@/components/dashboard/dashboard-risk-alerts";
import { CountUp } from "@/components/motion/count-up";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import { PresentationLauncher } from "@/components/presentation/presentation-toggle";
import {
  loadDashboardMetrics,
  loadDashboardSnapshot,
  loadProjects,
} from "@/server/demo/loaders";
import { formatDateTime } from "@/lib/format";

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
  const snapshot = loadDashboardSnapshot();
  const currentProject = projects[0];

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="智能驾驶舱"
        title="项目、Agent 与风险全景"
        description="基于 Phase 2 集中 Demo 数据，展示当前项目、最近 Run、Agent 池、人工复核与风险提醒。图表按需加载，不影响首屏。"
        icon={Activity}
        meta={
          <>
            <StatusBadge status="running" />
            <span className="text-xs text-muted-foreground">
              最近更新 · {formatDateTime(currentProject?.updatedAt)}
            </span>
          </>
        }
        actions={<PresentationLauncher />}
      />

      <section
        aria-labelledby="dashboard-metrics"
        className="flex flex-col gap-3"
      >
        <h2 id="dashboard-metrics" className="sr-only">
          关键指标
        </h2>
        <RevealOnScroll>
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
        </RevealOnScroll>
      </section>

      {currentProject ? (
        <DashboardCurrentProject
          project={currentProject}
          snapshot={snapshot}
        />
      ) : null}

      <section
        aria-labelledby="dashboard-task-trend"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="最近任务状态趋势"
          description="过去 12 小时内 Run 数量、进入人工复核和高风险拦截的演化。"
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TaskTrendChart
              labels={snapshot.taskTrend.labels}
              series={snapshot.taskTrend.series}
              title="Run 趋势 · 含复核与拦截"
              description="按小时统计，可联动 Phase 3 Run 详情"
              unit="次"
              height={280}
            />
          </div>
          <RiskDistributionChart
            data={snapshot.riskDistribution}
            title="方案风险分布"
            description="低 / 中 / 高 / 待复核方案数量"
          />
        </div>
      </section>

      <section
        aria-labelledby="dashboard-agent-stages"
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="Agent 阶段耗时"
          description="对应当前 Run 中每个 Workflow 步骤的平均耗时，可识别耗时最长的 Agent。"
        />
        <AgentStageChart
          data={snapshot.agentStages}
          title="阶段耗时（毫秒）"
          description="按 Workflow 步骤展示"
          unit="ms"
          height={280}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardRecentTasks tasks={snapshot.recentTasks} />
        <DashboardPendingReview reviews={snapshot.pendingReviews} />
      </div>

      <DashboardAgentActivityPanel agents={snapshot.agentActivity} />

      <DashboardKnowledgeStrip citations={snapshot.knowledgeCitations} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardRiskAlerts alerts={snapshot.riskAlerts} />
        <DashboardRecentReports reports={snapshot.recentReports} />
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="驾驶舱关键指标"
          description="所有数据由 `loadDashboardSnapshot` 提供，Phase 3 替换为 Server Action 时无需改动调用方签名。"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatHighlight label="完成度" value={snapshot.completionRatio * 100} suffix="%" />
          <StatHighlight label="已批准方案" value={snapshot.approvedSchemes} />
          <StatHighlight label="本周引用" value={snapshot.citationsThisWeek} />
          <StatHighlight label="运行 Run" value={snapshot.counters.activeProjects} />
        </div>
      </section>
    </WorkspacePage>
  );
}

function StatHighlight({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="tabular text-2xl font-semibold leading-tight text-foreground">
        <CountUp value={value} digits={0} suffix={suffix} durationMs={900} />
      </span>
    </div>
  );
}
import type { AgentStatus, ProjectStatus, RiskLevel } from "./demo";
import type {
  AgentStageDatum,
  RiskDistributionDatum,
  TaskTrendSeries,
} from "@/components/dashboard/charts/__types";

export interface DashboardAgentActivity {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  /** Human-readable current task summary. */
  currentTask: string;
  /** Load percentage 0-100. */
  load: number;
  /** Average step duration in milliseconds. */
  avgStepMs: number;
}

export interface DashboardRecentTask {
  id: string;
  projectName: string;
  scenario: "standard" | "complex" | "high-risk";
  status: ProjectStatus;
  startedAt: string;
  durationMs: number;
  schemes: number;
}

export interface DashboardPendingReview {
  id: string;
  title: string;
  /** The agent / system requesting human confirmation. */
  requestedBy: string;
  /** Why this needs human review. */
  reason: string;
  /** ISO timestamp when the request was created. */
  requestedAt: string;
  risk: RiskLevel;
}

export interface DashboardRiskAlert {
  id: string;
  /** Short risk title shown in the card. */
  title: string;
  /** Detailed reason / context. */
  detail: string;
  risk: RiskLevel;
  /** Owning project id, if any. */
  projectId?: string;
  /** ISO timestamp when the alert was raised. */
  raisedAt: string;
}

export interface DashboardKnowledgeCitation {
  id: string;
  /** Document title. */
  title: string;
  /** Document category (e.g. 规范 / 教材 / 材料). */
  category: string;
  /** Page or section reference. */
  reference: string;
  /** Owning agent name. */
  agent: string;
}

export interface DashboardRecentReport {
  id: string;
  title: string;
  status: "draft" | "pending-review" | "approved" | "archived";
  updatedAt: string;
  size: string;
}

export interface DashboardDemoSnapshot {
  agentActivity: readonly DashboardAgentActivity[];
  recentTasks: readonly DashboardRecentTask[];
  pendingReviews: readonly DashboardPendingReview[];
  riskAlerts: readonly DashboardRiskAlert[];
  knowledgeCitations: readonly DashboardKnowledgeCitation[];
  recentReports: readonly DashboardRecentReport[];
  taskTrend: { labels: readonly string[]; series: readonly TaskTrendSeries[] };
  agentStages: readonly AgentStageDatum[];
  riskDistribution: readonly RiskDistributionDatum[];
  completionRatio: number;
  approvedSchemes: number;
  citationsThisWeek: number;
  /** High-level numeric counters used by the page header. */
  counters: {
    activeProjects: number;
    pendingReview: number;
    knowledgeCitations: number;
    riskAlerts: number;
  };
}
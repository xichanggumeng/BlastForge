export type ProjectStatus =
  | "idle"
  | "running"
  | "waiting"
  | "blocked"
  | "completed";

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export type AgentMode = "thinking" | "non-thinking";

export type AgentStatus = "idle" | "busy" | "offline" | "error";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "blocked";

export interface DemoMetric {
  key: string;
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  hint?: string;
  tone?: "neutral" | "primary" | "accent" | "success" | "warning" | "danger";
}

export interface DemoProject {
  id: string;
  name: string;
  site: string;
  status: ProjectStatus;
  risk: RiskLevel;
  updatedAt: string;
  scenario: "standard" | "complex" | "high-risk";
  summary: string;
  progress: number;
}

export interface DemoAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  mode: AgentMode;
  status: AgentStatus;
  model: string;
  tools: readonly string[];
  version: string;
}

export interface DemoWorkflowStep {
  id: string;
  label: string;
  description: string;
  agentId: string;
  status: WorkflowStepStatus;
  requiresApproval: boolean;
}

export interface DemoWorkflowRun {
  id: string;
  projectId: string;
  status: WorkflowStepStatus;
  startedAt: string;
  durationMs: number;
  steps: readonly DemoWorkflowStep[];
}

export interface DemoKnowledgeDoc {
  id: string;
  title: string;
  category: string;
  page?: number;
  excerpt: string;
}

export interface DemoReport {
  id: string;
  projectId: string;
  title: string;
  status: "draft" | "pending-review" | "approved" | "archived";
  updatedAt: string;
  size: string;
}
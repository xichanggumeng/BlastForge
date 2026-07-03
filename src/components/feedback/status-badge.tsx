import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AgentStatus, ProjectStatus, WorkflowStepStatus } from "@/types/demo";

export type AnyStatus = ProjectStatus | AgentStatus | WorkflowStepStatus | string;

interface StatusMeta {
  label: string;
  tone: "neutral" | "primary" | "accent" | "success" | "warning" | "danger";
  icon?: LucideIcon;
}

const PROJECT_STATUS: Record<ProjectStatus, StatusMeta> = {
  idle: { label: "待启动", tone: "neutral" },
  running: { label: "执行中", tone: "primary" },
  waiting: { label: "等待输入", tone: "accent" },
  blocked: { label: "已阻断", tone: "danger" },
  completed: { label: "已完成", tone: "success" },
};

const AGENT_STATUS: Record<AgentStatus, StatusMeta> = {
  idle: { label: "空闲", tone: "neutral" },
  busy: { label: "执行中", tone: "primary" },
  offline: { label: "离线", tone: "warning" },
  error: { label: "异常", tone: "danger" },
};

const STEP_STATUS: Record<WorkflowStepStatus, StatusMeta> = {
  pending: { label: "等待", tone: "neutral" },
  running: { label: "执行中", tone: "primary" },
  succeeded: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  skipped: { label: "已跳过", tone: "neutral" },
  blocked: { label: "已阻断", tone: "warning" },
};

const FALLBACK: StatusMeta = { label: "未知", tone: "neutral" };

export function StatusBadge({ status }: { status: AnyStatus }) {
  const meta =
    PROJECT_STATUS[status as ProjectStatus] ??
    AGENT_STATUS[status as AgentStatus] ??
    STEP_STATUS[status as WorkflowStepStatus] ??
    FALLBACK;
  return (
    <Badge tone={meta.tone} aria-label={`状态：${meta.label}`}>
      {meta.label}
    </Badge>
  );
}
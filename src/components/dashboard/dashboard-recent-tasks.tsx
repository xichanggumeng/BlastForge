import { ListChecks, Workflow as WorkflowIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import type { DashboardRecentTask } from "@/types/dashboard";
import { cn } from "@/lib/cn";

interface DashboardRecentTasksProps {
  tasks: readonly DashboardRecentTask[];
}

const SCENARIO_LABEL: Record<DashboardRecentTask["scenario"], string> = {
  standard: "常规",
  complex: "复杂",
  "high-risk": "高风险",
};

const SCENARIO_TONE: Record<
  DashboardRecentTask["scenario"],
  "primary" | "accent" | "danger"
> = {
  standard: "primary",
  complex: "accent",
  "high-risk": "danger",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)} 秒`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec === 0 ? `${min} 分` : `${min} 分 ${sec} 秒`;
}

export function DashboardRecentTasks({ tasks }: DashboardRecentTasksProps) {
  return (
    <RevealOnScroll className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          最近规划任务
        </span>
        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {tasks.length} 个 Run 在过去 24 小时内执行
        </h2>
      </header>

      <Card tone="elevated" padding="none" className="overflow-hidden">
        <CardHeader className="border-b border-border px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <WorkflowIcon className="h-4 w-4 text-primary" aria-hidden />
              Run 时间线
            </CardTitle>
            <Badge tone="outline">Phase 2 预览</Badge>
          </div>
          <CardDescription>
            状态、场景、耗时与生成方案数；点击进入 Phase 3 完整 Trace。
          </CardDescription>
        </CardHeader>

        <ul className="divide-y divide-border" role="list">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6",
                task.status === "blocked" && "bg-danger/5",
              )}
            >
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {task.projectName}
                  </span>
                  <Badge tone={SCENARIO_TONE[task.scenario]}>
                    {SCENARIO_LABEL[task.scenario]}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {task.id}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  共生成 {task.schemes} 个方案 · 耗时 {formatDuration(task.durationMs)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={task.status} />
                <ListChecks
                  className={cn(
                    "h-4 w-4",
                    task.status === "blocked" ? "text-danger" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </RevealOnScroll>
  );
}
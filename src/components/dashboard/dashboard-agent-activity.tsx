import { Activity, Bot, Cpu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import type { DashboardAgentActivity } from "@/types/dashboard";
import type { AgentStatus } from "@/types/demo";
import { cn } from "@/lib/cn";

interface DashboardAgentActivityProps {
  agents: readonly DashboardAgentActivity[];
}

const STATUS_LABEL: Record<AgentStatus, { label: string; tone: "success" | "primary" | "warning" | "danger" }> = {
  idle: { label: "空闲", tone: "success" },
  busy: { label: "执行中", tone: "primary" },
  offline: { label: "离线", tone: "warning" },
  error: { label: "异常", tone: "danger" },
};

const TONE_STYLES: Record<
  "success" | "primary" | "warning" | "danger",
  string
> = {
  success: "border-success/40 bg-success/10 text-success",
  primary: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

export function DashboardAgentActivityPanel({ agents }: DashboardAgentActivityProps) {
  const online = agents.filter((a) => a.status !== "offline").length;

  return (
    <RevealOnScroll className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Agent 池活跃状态
        </span>
        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {online} / {agents.length} 个 Agent 正在参与当前 Run
        </h2>
        <p className="text-sm text-muted-foreground">
          每个 Agent 显示当前任务、负载与平均步骤耗时，作为驾驶舱的可观测性窗口。
        </p>
      </header>

      <Card tone="elevated" padding="lg" className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bot className="h-4 w-4 text-primary" aria-hidden />
              <span>Agent Pool · Phase 2 实时面板</span>
            </div>
            <Badge tone="primary">deepseek-v4-pro</Badge>
          </div>
          <CardDescription>
            所有 Agent 均通过统一 Provider Adapter 调用，工具调用受白名单约束。
          </CardDescription>
        </CardHeader>

        <CardContent>
          <ul className="flex flex-col gap-3">
            {agents.map((agent, idx) => {
              const meta = STATUS_LABEL[agent.status];
              const toneClass = TONE_STYLES[meta.tone];
              return (
                <li
                  key={agent.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-3 transition-colors sm:flex-row sm:items-center",
                    agent.status === "busy" && "border-primary/40",
                  )}
                >
                  <div className="flex flex-1 items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-surface-elevated",
                        toneClass,
                      )}
                    >
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {agent.name}
                        </span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-xs text-muted-foreground">{agent.role}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        当前任务：{agent.currentTask}
                      </span>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-56">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>负载</span>
                      <span className="tabular text-foreground">{agent.load}%</span>
                    </div>
                    <Progress
                      value={agent.load}
                      tone={
                        agent.load >= 75 ? "warning" : agent.load >= 45 ? "accent" : "primary"
                      }
                      size="sm"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>平均耗时</span>
                      <span className="tabular text-foreground">
                        {(agent.avgStepMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <span className="sr-only">第 {idx + 1} 个 Agent</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            <span>数据由 Phase 3 事件流提供；当前为静态模拟。</span>
          </span>
        </div>
      </Card>
    </RevealOnScroll>
  );
}
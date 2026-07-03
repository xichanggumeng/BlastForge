"use client";

/**
 * 规划执行时间线。
 *
 * 显示当前 Run 的步骤进度。
 * 每个步骤带有状态徽标 / 标签 / 描述，可点击展开查看 detail。
 */

import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleSlash,
  Loader2,
  PauseCircle,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { PlanningStepEvent, PlanningStepStatus } from "@/modules/parameter-planning/domain";

interface PlanningStepTimelineProps {
  steps: readonly PlanningStepEvent[];
  className?: string;
}

const STATUS_META: Record<PlanningStepStatus, {
  label: string;
  tone: "neutral" | "primary" | "success" | "warning" | "danger";
  icon: typeof Check;
  describe: string;
}> = {
  pending: {
    label: "等待",
    tone: "neutral",
    icon: CircleDashed,
    describe: "等待前面步骤完成。",
  },
  running: {
    label: "执行中",
    tone: "primary",
    icon: Loader2,
    describe: "正在执行当前步骤。",
  },
  succeeded: {
    label: "已完成",
    tone: "success",
    icon: Check,
    describe: "步骤已成功结束。",
  },
  warning: {
    label: "告警",
    tone: "warning",
    icon: ShieldAlert,
    describe: "步骤结束但有告警需复核。",
  },
  failed: {
    label: "失败",
    tone: "danger",
    icon: X,
    describe: "步骤执行失败。",
  },
  blocked: {
    label: "已阻断",
    tone: "danger",
    icon: ShieldAlert,
    describe: "Safety Reviewer 已阻断；需补充信息或人工复核。",
  },
  skipped: {
    label: "已跳过",
    tone: "neutral",
    icon: CircleSlash,
    describe: "因父级阻断已跳过。",
  },
};

export function PlanningStepTimeline({
  steps,
  className,
}: PlanningStepTimelineProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (idx: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <ol
      role="list"
      className={cn("flex flex-col gap-2", className)}
    >
      {steps.map((step, idx) => {
        const meta = STATUS_META[step.status];
        const Icon = meta.icon;
        const isExpanded = expanded.has(idx);
        const isRunning = step.status === "running";
        const isBlocked = step.status === "blocked";

        return (
          <li
            key={step.id}
            className={cn(
              "rounded-lg border bg-surface p-3 transition-colors",
              isBlocked
                ? "border-danger/40 bg-danger/5"
                : isRunning
                  ? "border-primary/40 bg-primary/5"
                  : "border-border",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => toggle(idx)}
              aria-expanded={isExpanded}
              aria-controls={`step-detail-${step.id}`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md border",
                    isRunning
                      ? "border-primary/40 bg-primary/10 text-primary animate-pulse"
                      : isBlocked
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-border bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <Icon
                    className={cn("h-4 w-4", isRunning && "animate-spin")}
                  />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {step.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {step.id}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={meta.tone} size="sm">
                  {meta.label}
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
              </span>
            </button>
            {isExpanded ? (
              <div
                id={`step-detail-${step.id}`}
                className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2 text-xs text-muted-foreground"
              >
                <p>{meta.describe}</p>
                {step.detail ? <p>{step.detail}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ExecutionCallout({
  phase,
  blockedReason,
}: {
  phase:
    | "idle"
    | "running"
    | "cancelling"
    | "cancelled"
    | "failed"
    | "done";
  blockedReason?: string;
}) {
  if (phase === "running") {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Workflow 正在推进；所有步骤均由 demo 规划引擎确定驱动。
      </div>
    );
  }
  if (phase === "cancelling") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        正在取消…
      </div>
    );
  }
  if (phase === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <PauseCircle className="h-4 w-4" aria-hidden />
        用户已取消本次运行。
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        <AlertCircle className="h-4 w-4" aria-hidden />
        Demo 规划引擎执行失败，请稍后重试。
      </div>
    );
  }
  if (phase === "done" && blockedReason) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        <span className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Safety Reviewer 已阻断。
        </span>
        <span className="text-xs text-danger/80">{blockedReason}</span>
      </div>
    );
  }
  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
        <Sparkles className="h-4 w-4" aria-hidden />
        本次 Workflow 已生成推荐方案与多方案对比。
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
      <CircleDashed className="h-4 w-4" aria-hidden />
      尚未启动规划。选择预设或修改表单后点击「启动规划」。
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { cn } from "@/lib/cn";
import { Surface } from "@/components/ui/surface";

export interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "primary" | "accent" | "success" | "warning" | "danger";
  loading?: boolean;
  footer?: ReactNode;
  className?: string;
}

const TONE_STYLES: Record<
  NonNullable<MetricCardProps["tone"]>,
  { accent: string; bg: string; border: string }
> = {
  neutral: {
    accent: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
  },
  primary: {
    accent: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  accent: {
    accent: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
  },
  success: {
    accent: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
  },
  warning: {
    accent: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
  danger: {
    accent: "text-danger",
    bg: "bg-danger/10",
    border: "border-danger/30",
  },
};

export function MetricCard({
  label,
  value,
  unit,
  delta,
  hint,
  icon: Icon,
  tone = "neutral",
  loading,
  footer,
  className,
}: MetricCardProps) {
  const styles = TONE_STYLES[tone];
  const DeltaIcon =
    delta === undefined
      ? null
      : delta > 0
        ? TrendingUp
        : delta < 0
          ? TrendingDown
          : Minus;
  const deltaColor =
    delta === undefined
      ? ""
      : delta > 0
        ? "text-success"
        : delta < 0
          ? "text-danger"
          : "text-muted-foreground";

  return (
    <Surface tone="elevated" padding="lg" className={cn("gap-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border",
              styles.bg,
              styles.border,
              styles.accent,
            )}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "tabular text-3xl font-semibold leading-none text-foreground",
            loading && "opacity-50",
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-sm text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {delta !== undefined && DeltaIcon ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular",
              deltaColor,
            )}
          >
            <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
            {(delta * 100).toFixed(1)}%
          </span>
        ) : (
          <span aria-hidden />
        )}
        {hint ? <span className="text-right">{hint}</span> : null}
      </div>
      {footer ? <div className="pt-1">{footer}</div> : null}
    </Surface>
  );
}
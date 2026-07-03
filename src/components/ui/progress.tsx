import { cn } from "@/lib/cn";

export interface ProgressProps {
  /** Current value (0–max). */
  value: number;
  /** Upper bound, defaults to 100. */
  max?: number;
  /** Optional accessible label describing what the progress represents. */
  label?: string;
  /** Tone selection to colour the bar. */
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
  /** Optional size of the bar. */
  size?: "sm" | "md";
  /** Show numeric value alongside the bar. */
  showValue?: boolean;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<ProgressProps["tone"]>, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const SIZE_CLASS: Record<NonNullable<ProgressProps["size"]>, string> = {
  sm: "h-1",
  md: "h-1.5",
};

/**
 * Visual progress bar with a11y-friendly `role="progressbar"`.
 * Pure CSS — no client JS — so it can be used in any Server Component.
 */
export function Progress({
  value,
  max = 100,
  label,
  tone = "primary",
  size = "md",
  showValue = false,
  className,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const percent = Math.round(ratio * 100);
  const accessibleLabel = label ?? `进度 ${percent}%`;

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={accessibleLabel}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-muted",
          SIZE_CLASS[size],
        )}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-base", TONE_CLASS[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue ? (
        <span className="tabular text-xs text-muted-foreground">{percent}%</span>
      ) : null}
    </div>
  );
}
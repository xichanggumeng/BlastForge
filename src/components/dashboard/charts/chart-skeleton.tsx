import { cn } from "@/lib/cn";

export interface ChartSkeletonProps {
  /** Accessible label for the loading state. */
  label?: string;
  /** Visible aspect ratio (width / height). Defaults to 16 / 9. */
  aspect?: number;
  /** Optional legend placeholder rows. */
  legendRows?: number;
  className?: string;
}

const ROW_HEIGHT = 8;

/**
 * Lightweight skeleton for charts. Used both during dynamic import and
 * for explicit `loading` states. No client JS — can be SSR'd.
 */
export function ChartSkeleton({
  label = "图表加载中",
  aspect = 16 / 9,
  legendRows = 0,
  className,
}: ChartSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/5 animate-pulse rounded bg-muted" />
      </div>
      <div
        className="relative w-full overflow-hidden rounded-md bg-muted/40"
        style={{ aspectRatio: aspect }}
      >
        <div className="absolute inset-0 flex flex-col justify-end gap-2 p-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-1.5 animate-pulse rounded bg-muted"
              style={{ width: `${50 + ((idx * 13) % 40)}%` }}
            />
          ))}
        </div>
      </div>
      {legendRows > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: legendRows }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="inline-block animate-pulse rounded-sm bg-muted"
                style={{ width: 10, height: ROW_HEIGHT }}
              />
              <span
                className="inline-block animate-pulse rounded bg-muted"
                style={{ width: 40 + ((idx * 9) % 30), height: ROW_HEIGHT }}
              />
            </div>
          ))}
        </div>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}
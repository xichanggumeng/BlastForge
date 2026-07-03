import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";

export interface LoadingStateProps {
  label?: string;
  description?: string;
  rows?: number;
  className?: string;
  children?: ReactNode;
}

export function LoadingState({
  label = "正在加载",
  description,
  rows = 3,
  className,
  children,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-muted-foreground">· {description}</span>
        ) : null}
      </div>
      {children ?? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }).map((_, idx) => (
            <Skeleton
              key={idx}
              className={cn("h-3 w-full", idx === rows - 1 && "w-2/3")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
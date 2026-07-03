import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Surface } from "@/components/ui/surface";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Surface
      tone="muted"
      padding="lg"
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </Surface>
  );
}
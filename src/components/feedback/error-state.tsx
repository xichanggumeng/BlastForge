import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/cn";
import { Surface } from "@/components/ui/surface";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "出现问题",
  description = "页面无法正常加载。请稍后重试或返回首页。",
  action,
  className,
}: ErrorStateProps) {
  return (
    <Surface
      tone="outline"
      padding="lg"
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-danger/40 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 text-danger"
      >
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </Surface>
  );
}
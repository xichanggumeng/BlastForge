import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface WorkspacePageProps {
  children: ReactNode;
  className?: string;
}

export function WorkspacePage({ children, className }: WorkspacePageProps) {
  return (
    <div className={cn("flex flex-col gap-8", className)}>{children}</div>
  );
}

interface WorkspaceGridProps {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export function WorkspaceGrid({
  children,
  className,
  columns = 3,
}: WorkspaceGridProps) {
  const cols =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 md:grid-cols-2"
        : columns === 3
          ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={cn("grid gap-4 lg:gap-6", cols, className)}>{children}</div>
  );
}
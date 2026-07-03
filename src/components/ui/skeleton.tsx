import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:translate-x-[-100%] after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent after:animate-[shimmer_1.6s_infinite]",
        className,
      )}
      {...props}
    />
  );
}
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-muted-foreground",
        primary: "border-primary/40 bg-primary/10 text-primary",
        accent: "border-accent/40 bg-accent/10 text-accent",
        success: "border-success/40 bg-success/10 text-success",
        warning: "border-warning/40 bg-warning/10 text-warning",
        danger: "border-danger/40 bg-danger/10 text-danger",
        outline: "border-border-strong bg-transparent text-foreground",
      },
      size: {
        sm: "text-[10px] px-2 py-0",
        md: "text-xs",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ tone, size }), className)}
      {...props}
    />
  );
}
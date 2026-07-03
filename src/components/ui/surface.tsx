import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const surfaceVariants = cva(
  "border border-border rounded-lg bg-surface text-foreground shadow-sm",
  {
    variants: {
      tone: {
        default: "bg-surface",
        elevated: "bg-surface-elevated shadow-md",
        outline: "bg-transparent shadow-none",
        muted: "bg-muted/60 shadow-none",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
        xl: "p-8",
      },
    },
    defaultVariants: {
      tone: "default",
      padding: "md",
    },
  },
);

export interface SurfaceProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

export function Surface({
  className,
  tone,
  padding,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(surfaceVariants({ tone, padding }), className)}
      {...props}
    />
  );
}
"use client";

import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95",
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 active:bg-accent/95",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        danger:
          "bg-danger text-primary-foreground shadow-sm hover:bg-danger/90 active:bg-danger/95",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-5 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  children,
  type,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  if (asChild) {
    // Slot requires a single child element. Callers must provide exactly one.
    return (
      <Slot
        className={cn(buttonVariants({ variant, size }), className)}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      data-loading={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : leftIcon ? (
        <span className="inline-flex items-center" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      <span>{children}</span>
      {!loading && rightIcon ? (
        <span className="inline-flex items-center" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
}

export { buttonVariants };
"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type RevealDirection = "up" | "down" | "left" | "right" | "none";

export interface RevealOnScrollProps
  extends Omit<HTMLMotionProps<"div">, "ref" | "children"> {
  /** Direction the element enters from. Defaults to `"up"`. */
  direction?: RevealDirection;
  /** Distance to translate from in pixels. */
  offset?: number;
  /** Delay before animation starts (seconds). */
  delay?: number;
  /** Duration of the animation in seconds. */
  duration?: number;
  /** Once visible, keep it visible. Defaults to `true`. */
  once?: boolean;
  /** IntersectionObserver threshold. */
  threshold?: number;
  /** Optional className for the wrapper element. */
  className?: string;
  /** Content to animate in. */
  children?: ReactNode;
}

const DIRECTION_OFFSET: Record<RevealDirection, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  none: { x: 0, y: 0 },
};

/**
 * Wraps children in a div that fades + slides into place once the user scrolls
 * it into view. Respects `prefers-reduced-motion`.
 */
export function RevealOnScroll({
  direction = "up",
  offset = 16,
  delay = 0,
  duration = 0.4,
  once = true,
  threshold = 0.2,
  className,
  children,
  ...rest
}: RevealOnScrollProps) {
  const reduce = useReducedMotion();
  const dir = DIRECTION_OFFSET[direction];

  const ref = useRef<HTMLDivElement | null>(null);

  if (reduce) {
    return (
      <div ref={ref} className={cn(className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: dir.x * offset, y: dir.y * offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount: threshold }}
      transition={{
        duration,
        delay,
        ease: [0.22, 0.61, 0.36, 1],
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
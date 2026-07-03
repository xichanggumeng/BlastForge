"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";

export interface CountUpProps {
  /** Target value rendered at the end of the animation. */
  value: number;
  /** Locale-aware formatting options. */
  locale?: string;
  /** Decimal digits to render. */
  digits?: number;
  /** Suffix appended to the number (e.g. "%"). */
  suffix?: string;
  /** Prefix rendered before the number (e.g. "≈"). */
  prefix?: string;
  /** Animation duration in ms. */
  durationMs?: number;
  /** Render as <span> by default. */
  className?: string;
  /** Trigger animation on mount when `false`, or when scrolled into view when `true`. */
  triggerOnView?: boolean;
  /** Threshold passed to IntersectionObserver. */
  threshold?: number;
}

const DEFAULT_LOCALE = "zh-CN";

/**
 * Animates from 0 → `value` once the element becomes visible.
 * Honors `prefers-reduced-motion` by jumping straight to the final value.
 */
export function CountUp({
  value,
  locale = DEFAULT_LOCALE,
  digits = 0,
  suffix,
  prefix,
  durationMs = 1200,
  triggerOnView = true,
  threshold = 0.4,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = useReducedMotion();
  const [hasBeenVisible, setHasBeenVisible] = useState(!triggerOnView);

  // Intersection observer: mark as visible once the user scrolls it in.
  useEffect(() => {
    if (hasBeenVisible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [hasBeenVisible, threshold]);

  // Animate from 0 → value once visible. We use a single effect with
  // a mounted-once guard via the `startedRef` instead of setting state
  // synchronously inside an effect.
  const startedRef = useRef(false);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!hasBeenVisible) return;
    if (reduced) {
      // Final value reached; paint it on the next animation frame
      // to avoid flushing state mid-effect.
      const id = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(id);
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const startTime = performance.now();
    let rafId = 0;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setProgress(eased);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setProgress(1);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [hasBeenVisible, reduced, durationMs]);

  const currentValue = Math.round(value * progress * Math.pow(10, digits)) / Math.pow(10, digits);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(currentValue);

  return (
    <span ref={ref} className={cn("tabular", className)} aria-label={`${value}`}>
      {prefix ? <span aria-hidden>{prefix}</span> : null}
      <span aria-hidden>{formatted}</span>
      {suffix ? <span aria-hidden>{suffix}</span> : null}
    </span>
  );
}
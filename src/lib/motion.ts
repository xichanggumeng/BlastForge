/**
 * Motion preferences detection. SSR-safe: defaults to no-preference
 * and only enables reduced motion once the user agent is known.
 */
"use client";

import { useEffect, useState } from "react";

export interface MotionPreference {
  /**
   * `true` when the user agent requests reduced motion.
   * During SSR / before hydration this is always `false` so first paint is stable.
   */
  reduced: boolean;
  /**
   * `true` once the actual media query has been read on the client.
   */
  ready: boolean;
}

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(QUERY);
    const apply = () => setReduced(media.matches);
    apply();
    // Older Safari uses `addListener`.
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  return reduced;
}

/**
 * Returns `0` when reduced motion is active, otherwise the duration in seconds.
 * Use this value to short-circuit animation timings.
 */
export function useMotionDuration(baseMs: number): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : baseMs / 1000;
}
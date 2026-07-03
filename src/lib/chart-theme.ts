/**
 * Chart theme tokens for ECharts. All values resolve from CSS variables
 * defined in `globals.css`, so charts automatically match the dark / light
 * theme without any manual reconfiguration.
 *
 * The actual values are read at runtime via `getComputedStyle`, so that the
 * values stay in sync with our design system without re-compiling on token
 * changes.
 */

import type { EChartsOption } from "echarts";

export interface ChartTheme {
  foreground: string;
  muted: string;
  border: string;
  surface: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  fontFamily: string;
}

const COLOR_VARS: Record<keyof Omit<ChartTheme, "fontFamily">, string> = {
  foreground: "--foreground",
  muted: "--muted-foreground",
  border: "--border",
  surface: "--surface",
  primary: "--primary",
  accent: "--accent",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
};

let cached: ChartTheme | null = null;

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value.length > 0 ? value : fallback;
}

export function getChartTheme(): ChartTheme {
  if (cached) return cached;
  cached = {
    foreground: readCssVar(COLOR_VARS.foreground, "#e6edf5"),
    muted: readCssVar(COLOR_VARS.muted, "#93a1b5"),
    border: readCssVar(COLOR_VARS.border, "#1f2a38"),
    surface: readCssVar(COLOR_VARS.surface, "#111821"),
    primary: readCssVar(COLOR_VARS.primary, "#f2871e"),
    accent: readCssVar(COLOR_VARS.accent, "#46c2d9"),
    success: readCssVar(COLOR_VARS.success, "#3dbe8b"),
    warning: readCssVar(COLOR_VARS.warning, "#f2b544"),
    danger: readCssVar(COLOR_VARS.danger, "#e5484d"),
    fontFamily:
      "var(--font-geist-sans), 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  };
  return cached;
}

/**
 * Drop the cache when theme changes so charts re-read tokens.
 * Call from a useEffect on `data-theme`.
 */
export function invalidateChartThemeCache(): void {
  cached = null;
}

/** Common options for axis grids. */
export function axisGrid(theme: ChartTheme, hideX = false): Pick<
  EChartsOption,
  "xAxis" | "yAxis" | "grid"
> {
  return {
    grid: { left: 40, right: 16, top: 16, bottom: 28, containLabel: false },
    xAxis: hideX
      ? { type: "category", show: false }
      : {
          type: "category",
          axisLine: { lineStyle: { color: theme.border } },
          axisTick: { show: false },
          axisLabel: { color: theme.muted, fontFamily: theme.fontFamily, fontSize: 11 },
        },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.border, type: "dashed" } },
      axisLabel: { color: theme.muted, fontFamily: theme.fontFamily, fontSize: 11 },
    },
  };
}

/** Default tooltip styling matching the design tokens. */
export function tooltip(theme: ChartTheme): EChartsOption["tooltip"] {
  return {
    trigger: "axis",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: {
      color: theme.foreground,
      fontFamily: theme.fontFamily,
      fontSize: 12,
    },
    extraCssText: "box-shadow: var(--shadow-md); border-radius: var(--radius-md);",
  };
}
/**
 * Pure type definitions for charts. Kept out of the client-only
 * `dashboard-charts.tsx` so that server modules can import the types
 * without dragging in the dynamic chart components.
 */

export interface AgentStageDatum {
  /** Stage / step label. */
  stage: string;
  /** Time spent in milliseconds. */
  durationMs: number;
  /** Optional owning agent label. */
  agent?: string;
}

export type RiskDistributionBucket = "low" | "medium" | "high" | "unknown";

export interface RiskDistributionDatum {
  bucket: RiskDistributionBucket;
  label: string;
  count: number;
}

export interface TaskTrendSeries {
  /** Series name rendered in the legend. */
  name: string;
  /** Tone to colour the series. */
  tone: "primary" | "accent" | "success" | "warning" | "danger";
  /** Y-axis values aligned to `labels`. */
  values: readonly number[];
}

export interface TaskTrendChartProps {
  labels: readonly string[];
  series: readonly TaskTrendSeries[];
  title?: string;
  description?: string;
  unit?: string;
  height?: number;
  className?: string;
  empty?: boolean;
}
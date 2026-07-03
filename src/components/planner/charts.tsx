"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import { ChartSkeleton } from "@/components/dashboard/charts/chart-skeleton";

export type { SchemeRadarSeries, SchemeRadarChartProps } from "./scheme-radar-chart";
export const SchemeRadarChart: ComponentType<
  import("./scheme-radar-chart").SchemeRadarChartProps
> = dynamic(
  () =>
    import("./scheme-radar-chart").then((m) => m.SchemeRadarChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton label="雷达图加载中" aspect={1.4} />,
  },
);

export type { SchemeBarDatum, SchemeBarChartProps } from "./scheme-bar-chart";
export const SchemeBarChart: ComponentType<
  import("./scheme-bar-chart").SchemeBarChartProps
> = dynamic(
  () =>
    import("./scheme-bar-chart").then((m) => m.SchemeBarChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton label="柱状图加载中" />,
  },
);

export type { SensitivityHeatmapChartProps } from "./sensitivity-heatmap-chart";
export const SensitivityHeatmapChart: ComponentType<
  import("./sensitivity-heatmap-chart").SensitivityHeatmapChartProps
> = dynamic(
  () =>
    import("./sensitivity-heatmap-chart").then((m) => m.SensitivityHeatmapChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton label="热力图加载中" />,
  },
);

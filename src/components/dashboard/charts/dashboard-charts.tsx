"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import { ChartSkeleton } from "./chart-skeleton";
import type {
  AgentStageChartProps,
} from "./agent-stage-chart";
import type {
  RiskDistributionChartProps,
} from "./risk-distribution-chart";
import type {
  TaskTrendChartProps,
} from "./task-trend-chart";

/**
 * ECharts is dynamically loaded on the client. We avoid SSR to keep the
 * landing page bundle small (per design spec §25).
 */
export const AgentStageChart = dynamic<AgentStageChartProps>(
  () => import("./agent-stage-chart").then((m) => m.AgentStageChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton label="Agent 阶段耗时加载中" />,
  },
) as ComponentType<AgentStageChartProps>;

export const RiskDistributionChart = dynamic<RiskDistributionChartProps>(
  () => import("./risk-distribution-chart").then((m) => m.RiskDistributionChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton label="风险分布加载中" aspect={1.4} />,
  },
) as ComponentType<RiskDistributionChartProps>;

export const TaskTrendChart = dynamic<TaskTrendChartProps>(
  () => import("./task-trend-chart").then((m) => m.TaskTrendChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton label="任务趋势加载中" />,
  },
) as ComponentType<TaskTrendChartProps>;

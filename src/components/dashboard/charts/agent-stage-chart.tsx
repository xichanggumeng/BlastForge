"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { getChartTheme, tooltip } from "@/lib/chart-theme";
import { cn } from "@/lib/cn";
import type { AgentStageDatum } from "./__types";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
  CanvasRenderer,
]);

export type { AgentStageDatum };

export interface AgentStageChartProps {
  data: readonly AgentStageDatum[];
  /** Accessible title. */
  title?: string;
  /** Visible subtitle / description. */
  description?: string;
  /** Unit string for the tooltip / axis. */
  unit?: string;
  /** Optional height override. */
  height?: number;
  className?: string;
  /** Show the empty-state UI when `data` is empty. */
  empty?: boolean;
}

function formatMs(value: number): string {
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export function AgentStageChart({
  data,
  title,
  description,
  unit = "ms",
  height = 280,
  className,
  empty,
}: AgentStageChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const reduceMotion = useReducedMotion();
  const [isReady, setIsReady] = useState(false);

  // Initialise chart instance on mount, dispose on unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = echarts.init(containerRef.current, undefined, {
      renderer: "canvas",
    });
    instanceRef.current = instance;
    setIsReady(true);
    const onResize = () => instance.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  const option = useMemo<EChartsOption | null>(() => {
    if (empty || data.length === 0) return null;
    const theme = getChartTheme();
    const labels = data.map((d) => d.stage);
    const values = data.map((d) => Math.round(d.durationMs));
    const maxValue = Math.max(...values, 1);

    const seriesColors = values.map((v) => {
      const ratio = v / maxValue;
      if (ratio >= 0.75) return theme.warning;
      if (ratio >= 0.45) return theme.accent;
      return theme.primary;
    });

    return {
      animation: !reduceMotion,
      animationDuration: reduceMotion ? 0 : 700,
      textStyle: { fontFamily: theme.fontFamily, color: theme.foreground },
      tooltip: {
        ...tooltip(theme),
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const item = arr[0];
          if (!item || typeof item !== "object") return "";
          const idx = item.dataIndex ?? 0;
          const datum = data[idx];
          if (!datum) return "";
          const agent = datum.agent ? `<br/>Agent：${datum.agent}` : "";
          const duration = formatMs(datum.durationMs);
          return `<div style="font-weight:600">${datum.stage}</div>${duration}${agent}<br/>单位：${unit}`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
          interval: 0,
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: theme.border, type: "dashed" } },
        axisLabel: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
          formatter: (value: number) => formatMs(value),
        },
      },
      grid: { left: 48, right: 16, top: title ? 36 : 16, bottom: 36, containLabel: false },
      title: title
        ? {
            text: title,
            subtext: description,
            left: 0,
            top: 0,
            textStyle: {
              color: theme.foreground,
              fontFamily: theme.fontFamily,
              fontSize: 13,
              fontWeight: 600,
            },
            subtextStyle: {
              color: theme.muted,
              fontFamily: theme.fontFamily,
              fontSize: 11,
            },
          }
        : undefined,
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: seriesColors[i], borderRadius: [6, 6, 0, 0] },
          })),
          barMaxWidth: 28,
          label: {
            show: true,
            position: "top",
            color: theme.muted,
            fontFamily: theme.fontFamily,
            fontSize: 10,
            formatter: (params) => {
              const value = typeof params === "object" && "value" in params ? params.value : 0;
              return formatMs(Number(value) || 0);
            },
          },
        },
      ],
    };
  }, [data, empty, reduceMotion, title, description, unit]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
  }, [option]);

  if (empty || data.length === 0) {
    return (
      <ChartEmpty
        title={title ?? "Agent 阶段耗时"}
        description={description ?? "等待下一次 Run 产生数据。"}
        className={className}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={title ?? "Agent 阶段耗时"}
      className={cn(
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height, opacity: isReady ? 1 : 0.4 }}
        data-testid="agent-stage-chart"
      />
    </div>
  );
}

function ChartEmpty({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={`${title}：暂无数据`}
      className={cn(
        "flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <span className="text-base font-medium text-foreground">{title}</span>
      <span>{description}</span>
    </div>
  );
}
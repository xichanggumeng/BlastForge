"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { getChartTheme, tooltip } from "@/lib/chart-theme";
import { cn } from "@/lib/cn";
import type { TaskTrendChartProps, TaskTrendSeries } from "./__types";

echarts.use([
  LineChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export type { TaskTrendChartProps, TaskTrendSeries };

const TONE_VARS: Record<TaskTrendSeries["tone"], string> = {
  primary: "--primary",
  accent: "--accent",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
};

export function TaskTrendChart({
  labels,
  series,
  title,
  description,
  unit,
  height = 280,
  className,
  empty,
}: TaskTrendChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const reduceMotion = useReducedMotion();
  const [isReady, setIsReady] = useState(false);

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
    if (empty || labels.length === 0 || series.length === 0) return null;
    const theme = getChartTheme();

    const colors = series.map((s) => {
      const cssVar = TONE_VARS[s.tone];
      if (typeof window === "undefined") return theme.primary;
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim();
      return value || theme.primary;
    });

    return {
      animation: !reduceMotion,
      animationDuration: reduceMotion ? 0 : 700,
      textStyle: { fontFamily: theme.fontFamily, color: theme.foreground },
      grid: { left: 36, right: 16, top: title ? 40 : 16, bottom: 36, containLabel: false },
      tooltip: {
        ...tooltip(theme),
        valueFormatter: (val) => {
          if (typeof val !== "number") return String(val);
          return unit ? `${val} ${unit}` : String(val);
        },
      },
      legend: {
        bottom: 0,
        left: "center",
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 4,
        textStyle: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
        },
      },
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
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: [...labels],
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
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
        },
      },
      series: series.map((s, idx) => ({
        type: "line",
        name: s.name,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: colors[idx] },
        itemStyle: { color: colors[idx] },
        emphasis: { focus: "series" },
        data: [...s.values],
        areaStyle:
          idx === 0
            ? {
                color: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${colors[idx]}55` },
                    { offset: 1, color: `${colors[idx]}00` },
                  ],
                },
              }
            : undefined,
      })),
    };
  }, [empty, labels, series, title, description, unit, reduceMotion]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
  }, [option]);

  if (empty || labels.length === 0 || series.length === 0) {
    return (
      <div
        role="status"
        aria-label={`${title ?? "任务趋势"}：暂无数据`}
        className={cn(
          "flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <span className="text-base font-medium text-foreground">
          {title ?? "任务趋势"}
        </span>
        <span>{description ?? "等待 Run 积累足够数据。"}</span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title ?? "任务趋势"}
      className={cn(
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height, opacity: isReady ? 1 : 0.4 }}
        data-testid="task-trend-chart"
      />
    </div>
  );
}
/**
 * 参数敏感性热力图。
 *
 * 行：参数 key；
 * 列：调整档位（-2..+2）；
 * 单元格颜色：评分 Δ（绝对值越大颜色越深，方向越负越冷，方向越正越暖）。
 *
 * Tooltip 展示「参数 → 档位 → 输出评分变化」。
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { HeatmapChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { getChartTheme, tooltip } from "@/lib/chart-theme";
import { cn } from "@/lib/cn";

echarts.use([
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

const PARAM_LABEL: Record<string, string> = {
  linearChargeDensity: "装药集中度",
  holeSpacing: "孔距",
  maxChargePerDelay: "单响药量",
  stemmingLength: "堵塞长度",
  burdenDistance: "抵抗线",
};

export interface SensitivityHeatmapChartProps {
  axes: readonly string[];
  cells: readonly { parameterKey: string; delta: number; outputDelta: number }[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  empty?: boolean;
}

export function SensitivityHeatmapChart({
  axes,
  cells,
  title,
  description,
  height = 280,
  className,
  empty,
}: SensitivityHeatmapChartProps) {
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
    if (empty || axes.length === 0 || cells.length === 0) return null;
    const theme = getChartTheme();
    const cols = [-2, -1, 0, 1, 2].map((d) => (d > 0 ? `+${d}` : `${d}`));

    const data = cells.map((cell) => {
      const x = cell.delta + 2;
      const y = axes.indexOf(cell.parameterKey);
      return [x, y, cell.outputDelta];
    });

    return {
      animation: !reduceMotion,
      animationDuration: reduceMotion ? 0 : 600,
      textStyle: { fontFamily: theme.fontFamily, color: theme.foreground },
      tooltip: {
        ...tooltip(theme),
        trigger: "item",
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const item = arr[0];
          if (!item || typeof item !== "object" || !("data" in item)) return "";
          const tuple = (item as { data?: [number, number, number] }).data;
          if (!tuple) return "";
          const paramKey = axes[tuple[1]] ?? "";
          const label = PARAM_LABEL[paramKey] ?? paramKey;
          const deltaSign = (tuple[0] - 2 > 0 ? "+" : "") + (tuple[0] - 2);
          const value = tuple[2];
          const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "·";
          return `<div style="font-weight:600">${label} · 档位 ${deltaSign}</div>
            方案综合评分变化：${arrow} ${value.toFixed(1)}`;
        },
      },
      grid: {
        left: 96,
        right: 32,
        top: title ? 60 : 16,
        bottom: 36,
        containLabel: false,
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
        data: cols,
        splitArea: { show: true },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
        },
      },
      yAxis: {
        type: "category",
        data: axes.map((key) => PARAM_LABEL[key] ?? key),
        splitArea: { show: true },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
        },
      },
      visualMap: {
        min: -20,
        max: 20,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        textStyle: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 10,
        },
        inRange: {
          color: [theme.success, theme.surface, theme.warning, theme.danger],
        },
      },
      series: [
        {
          type: "heatmap",
          data,
          label: {
            show: true,
            color: theme.foreground,
            fontFamily: theme.fontFamily,
            fontSize: 10,
            formatter: (params) => {
              const arr = Array.isArray(params) ? params : [params];
              const item = arr[0];
              if (!item || typeof item !== "object" || !("data" in item)) return "";
              const tuple = (item as { data?: [number, number, number] }).data;
              if (!tuple) return "";
              const v = tuple[2];
              return `${v > 0 ? "+" : ""}${v.toFixed(0)}`;
            },
          },
        },
      ],
    };
  }, [axes, cells, empty, reduceMotion, title, description]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
  }, [option]);

  if (empty || axes.length === 0 || cells.length === 0) {
    return (
      <div
        role="status"
        aria-label={`${title ?? "敏感性热力图"}：暂无数据`}
        className={cn(
          "flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <span className="text-base font-medium text-foreground">
          {title ?? "敏感性热力图"}
        </span>
        <span>{description ?? "等待 Run 完成后展示。"}</span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title ?? "参数敏感性热力图"}
      className={cn(
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height, opacity: isReady ? 1 : 0.4 }}
        data-testid="scheme-heatmap-chart"
      />
    </div>
  );
}

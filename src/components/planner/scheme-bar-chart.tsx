/**
 * 核心参数对比柱状图（分组柱状图）。
 *
 * 每组代表一个参数 key，多个方案在该参数下的取值并列展示。
 * 选中方案高亮，其他方案灰色透明。
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { getChartTheme, tooltip } from "@/lib/chart-theme";
import { cn } from "@/lib/cn";

echarts.use([
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
]);

export interface SchemeBarDatum {
  /** 方案 id */
  schemeId: string;
  /** 方案标签（如推荐 / 备选 / 风险） */
  tag: string;
  /** 方案类别：用于色调 */
  category: "recommended" | "alternative" | "risk";
  /** 多组数据：参数 key → 数值 */
  values: Record<string, number>;
}

export interface SchemeBarChartProps {
  data: readonly SchemeBarDatum[];
  /** 参数 key 列表（横轴分组） */
  paramKeys: readonly { key: string; label: string; unit: string }[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  empty?: boolean;
  /** 当前选中方案 id（高亮） */
  selectedSchemeId?: string;
}

const CATEGORY_COLOR_KEY: Record<SchemeBarDatum["category"], "primary" | "accent" | "warning"> = {
  recommended: "primary",
  alternative: "accent",
  risk: "warning",
};

export function SchemeBarChart({
  data,
  paramKeys,
  title,
  description,
  height = 280,
  className,
  empty,
  selectedSchemeId,
}: SchemeBarChartProps) {
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
    if (empty || data.length === 0 || paramKeys.length === 0) return null;
    const theme = getChartTheme();
    const toneColor = (tone: "primary" | "accent" | "warning"): string => {
      switch (tone) {
        case "primary":
          return theme.primary;
        case "accent":
          return theme.accent;
        case "warning":
          return theme.warning;
      }
    };

    return {
      animation: !reduceMotion,
      animationDuration: reduceMotion ? 0 : 700,
      textStyle: { fontFamily: theme.fontFamily, color: theme.foreground },
      tooltip: {
        ...tooltip(theme),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const item = arr[0];
          if (!item || typeof item !== "object") return "";
          const paramIdx = item.dataIndex ?? 0;
          const param = paramKeys[paramIdx];
          if (!param) return "";
          const lines = arr.map((entry) => {
            const obj = entry as { seriesName?: string; value?: number };
            const value = typeof obj.value === "number" ? obj.value : 0;
            return `${obj.seriesName ?? ""}：${value.toFixed(2)} ${param.unit}`;
          });
          return `<div style="font-weight:600">${param.label}（${param.unit}）</div>${lines.join("<br/>")}`;
        },
      },
      legend: {
        bottom: 0,
        left: "center",
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
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
      grid: { left: 16, right: 16, top: title ? 56 : 16, bottom: 44, containLabel: true },
      xAxis: {
        type: "category",
        data: paramKeys.map((p) => p.label),
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
          interval: 0,
          formatter: (value: string) => (value.length > 6 ? `${value.slice(0, 6)}…` : value),
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
      series: data.map((d) => {
        const isHighlighted = !selectedSchemeId || d.schemeId === selectedSchemeId;
        return {
          name: d.tag,
          type: "bar" as const,
          barMaxWidth: 28,
          data: paramKeys.map((p) => d.values[p.key] ?? 0),
          itemStyle: {
            color: toneColor(CATEGORY_COLOR_KEY[d.category]),
            borderRadius: [6, 6, 0, 0],
            opacity: isHighlighted ? 1 : 0.25,
          },
          emphasis: { focus: "series" as const },
        };
      }),
    };
  }, [data, paramKeys, empty, reduceMotion, title, description, selectedSchemeId]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
  }, [option]);

  if (empty || data.length === 0 || paramKeys.length === 0) {
    return (
      <div
        role="status"
        aria-label={`${title ?? "参数对比"}：暂无数据`}
        className={cn(
          "flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <span className="text-base font-medium text-foreground">
          {title ?? "参数对比"}
        </span>
        <span>{description ?? "等待参数预测后展示。"}</span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title ?? "参数对比柱状图"}
      className={cn(
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height, opacity: isReady ? 1 : 0.4 }}
        data-testid="scheme-bar-chart"
      />
    </div>
  );
}

/**
 * 多方案雷达图。
 *
 * 每条线代表一个方案，颜色按方案类别区分。
 * 数据来源：scheme.score（safety / suitability / economy / convenience / environment）。
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { RadarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { getChartTheme, tooltip } from "@/lib/chart-theme";
import { cn } from "@/lib/cn";
import type { SchemeScore } from "@/modules/parameter-planning/domain";

echarts.use([
  RadarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export interface SchemeRadarSeries {
  id: string;
  name: string;
  tag: string;
  score: SchemeScore;
  /** 强调该方案（高亮显示） */
  highlighted?: boolean;
}

export interface SchemeRadarChartProps {
  series: readonly SchemeRadarSeries[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  empty?: boolean;
}

const DIMENSIONS = [
  { key: "safety", label: "安全性", max: 100 },
  { key: "suitability", label: "适用性", max: 100 },
  { key: "economy", label: "经济性", max: 100 },
  { key: "convenience", label: "施工便利", max: 100 },
  { key: "environment", label: "环境影响", max: 100 },
] as const;

const SCHEME_TONE: Record<string, "primary" | "accent" | "warning" | "danger"> = {
  recommended: "primary",
  alternative: "accent",
  risk: "warning",
};

export function SchemeRadarChart({
  series,
  title,
  description,
  height = 280,
  className,
  empty,
}: SchemeRadarChartProps) {
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
    if (empty || series.length === 0) return null;
    const theme = getChartTheme();
    const toneColor = (tone: "primary" | "accent" | "warning" | "danger"): string => {
      switch (tone) {
        case "primary":
          return theme.primary;
        case "accent":
          return theme.accent;
        case "warning":
          return theme.warning;
        case "danger":
          return theme.danger;
      }
    };

    return {
      animation: !reduceMotion,
      animationDuration: reduceMotion ? 0 : 700,
      textStyle: { fontFamily: theme.fontFamily, color: theme.foreground },
      tooltip: {
        ...tooltip(theme),
        trigger: "item",
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const item = arr[0];
          if (!item || typeof item !== "object" || !("data" in item)) return "";
          const id = (item as { dataIndex?: number }).dataIndex ?? 0;
          const datum = series[id];
          if (!datum) return "";
          return `<div style="font-weight:600">${datum.tag}</div>
            安全 ${Math.round(datum.score.safety)} · 适用 ${Math.round(datum.score.suitability)}<br/>
            经济 ${Math.round(datum.score.economy)} · 便利 ${Math.round(datum.score.convenience)}<br/>
            环境 ${Math.round(datum.score.environment)}<br/>
            综合 ${Math.round(datum.score.overall)}`;
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
      radar: {
        indicator: DIMENSIONS.map((d) => ({ name: d.label, max: d.max })),
        radius: "62%",
        center: ["50%", "46%"],
        axisName: {
          color: theme.muted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: theme.border } },
        splitArea: { areaStyle: { color: ["transparent", "transparent"] } },
        axisLine: { lineStyle: { color: theme.border } },
      },
      series: [
        {
          type: "radar",
          emphasis: { focus: "self" },
          symbolSize: 4,
          data: series.map((s) => {
            const tone = (SCHEME_TONE[s.tag] ?? "primary");
            const isHighlighted = s.highlighted ?? true;
            return {
              name: s.tag,
              value: DIMENSIONS.map((d) => Math.round(s.score[d.key])),
              symbol: "circle",
              lineStyle: {
                width: isHighlighted ? 2 : 1,
                color: toneColor(tone),
                opacity: isHighlighted ? 0.95 : 0.4,
              },
              itemStyle: {
                color: toneColor(tone),
                opacity: isHighlighted ? 1 : 0.4,
              },
              areaStyle: {
                color: toneColor(tone),
                opacity: isHighlighted ? 0.18 : 0.06,
              },
            };
          }),
        },
      ],
    };
  }, [series, empty, reduceMotion, title, description]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
  }, [option]);

  if (empty || series.length === 0) {
    return (
      <div
        role="status"
        aria-label={`${title ?? "方案雷达图"}：暂无数据`}
        className={cn(
          "flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <span className="text-base font-medium text-foreground">
          {title ?? "方案雷达图"}
        </span>
        <span>{description ?? "等待方案数据后展示。"}</span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title ?? "多方案雷达图"}
      className={cn(
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height, opacity: isReady ? 1 : 0.4 }}
        data-testid="scheme-radar-chart"
      />
    </div>
  );
}

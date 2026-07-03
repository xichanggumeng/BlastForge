"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { getChartTheme, tooltip } from "@/lib/chart-theme";
import { cn } from "@/lib/cn";
import type { RiskDistributionBucket, RiskDistributionDatum } from "./__types";

echarts.use([
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export type { RiskDistributionBucket, RiskDistributionDatum };
export type RiskBucket = RiskDistributionBucket;

export interface RiskDistributionChartProps {
  data: readonly RiskDistributionDatum[];
  title?: string;
  description?: string;
  /** Aspect ratio for the chart container; defaults to 1 (square). */
  aspect?: number;
  className?: string;
  empty?: boolean;
}

const BUCKET_COLORS: Record<RiskDistributionBucket, (theme: ReturnType<typeof getChartTheme>) => string> = {
  low: (t) => t.success,
  medium: (t) => t.warning,
  high: (t) => t.danger,
  unknown: (t) => t.muted,
};

export function RiskDistributionChart({
  data,
  title,
  description,
  aspect = 1.4,
  className,
  empty,
}: RiskDistributionChartProps) {
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

  const totals = useMemo(() => {
    const total = data.reduce((acc, d) => acc + d.count, 0);
    return total === 0 ? "0" : String(total);
  }, [data]);

  const option = useMemo<EChartsOption | null>(() => {
    if (empty || data.length === 0 || data.every((d) => d.count === 0)) return null;
    const theme = getChartTheme();

    return {
      animation: !reduceMotion,
      animationDuration: reduceMotion ? 0 : 700,
      textStyle: { fontFamily: theme.fontFamily, color: theme.foreground },
      tooltip: {
        ...tooltip(theme),
        trigger: "item",
        formatter: (params) => {
          const p = params as unknown as {
            name?: string;
            value?: number;
            percent?: number;
          };
          return `<div style="font-weight:600">${p.name ?? ""}</div>${
            p.value ?? 0
          } 项 · ${p.percent?.toFixed(1) ?? 0}%`;
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
      series: [
        {
          type: "pie",
          radius: ["55%", "78%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data: data.map((d) => ({
            name: d.label,
            value: d.count,
            itemStyle: { color: BUCKET_COLORS[d.bucket](theme) },
          })),
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "38%",
          style: {
            text: totals,
            textAlign: "center",
            fill: theme.foreground,
            fontSize: 22,
            fontFamily: theme.fontFamily,
            fontWeight: 600,
          },
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          style: {
            text: "方案总数",
            textAlign: "center",
            fill: theme.muted,
            fontSize: 11,
            fontFamily: theme.fontFamily,
          },
        },
      ],
    };
  }, [data, empty, reduceMotion, title, description, totals]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
  }, [option]);

  if (empty || data.length === 0) {
    return (
      <div
        role="status"
        aria-label={`${title ?? "风险分布"}：暂无数据`}
        className={cn(
          "flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <span className="text-base font-medium text-foreground">
          {title ?? "风险分布"}
        </span>
        <span>{description ?? "等待方案数据后展示。"}</span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title ?? "方案风险分布"}
      className={cn(
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", aspectRatio: aspect, opacity: isReady ? 1 : 0.4 }}
        data-testid="risk-distribution-chart"
      />
    </div>
  );
}
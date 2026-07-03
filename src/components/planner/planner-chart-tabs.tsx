"use client";

/**
 * 图表标签切换。
 *
 * 三种图表：
 * - radar: 多方案雷达图
 * - bar:   核心参数对比柱状图
 * - heatmap: 参数敏感性热力图
 *
 * Mobile 上自动堆叠为纵向布局。
 */

import { BarChart3, Grid3x3, Radar } from "lucide-react";

import { cn } from "@/lib/cn";
import type { PlanningRun, Scheme } from "@/modules/parameter-planning/domain";
import {
  SchemeBarChart,
  SchemeRadarChart,
  SensitivityHeatmapChart,
  type SchemeRadarSeries,
  type SchemeBarDatum,
} from "./charts";

export type PlannerChartKey = "radar" | "bar" | "heatmap";

export interface PlannerChartTabsProps {
  run: PlanningRun;
  selectedSchemeId: string;
  className?: string;
  active?: PlannerChartKey;
  onSelect?: (key: PlannerChartKey) => void;
}

const TABS: Array<{
  key: PlannerChartKey;
  label: string;
  icon: typeof Radar;
  description: string;
}> = [
  {
    key: "radar",
    label: "多方案雷达",
    icon: Radar,
    description: "比较五维评分：安全 / 适用 / 经济 / 便利 / 环境。",
  },
  {
    key: "bar",
    label: "参数对比柱",
    icon: BarChart3,
    description: "展示推荐 / 备选 / 风险的核心参数差异。",
  },
  {
    key: "heatmap",
    label: "敏感性热力图",
    icon: Grid3x3,
    description: "围绕 ±15% 调整检查综合评分变化，识别敏感参数。",
  },
];

export function PlannerChartTabs({
  run,
  selectedSchemeId,
  className,
  active: activeExternal,
  onSelect,
}: PlannerChartTabsProps) {
  const active = activeExternal ?? "radar";

  const radarSeries: SchemeRadarSeries[] = run.schemeSet.schemes.map((s) => ({
    id: s.id,
    name: s.label,
    tag: s.tag,
    score: s.score,
    highlighted: !selectedSchemeId || s.id === selectedSchemeId,
  }));

  const selected = run.schemeSet.schemes.find((s) => s.id === selectedSchemeId);

  const paramKeys = dedupeParamKeys(selected ?? run.schemeSet.schemes[0]);
  const barData: SchemeBarDatum[] = run.schemeSet.schemes.map((scheme) => {
    const summary = Object.fromEntries(
      scheme.parameterSummary.map((p) => [p.key, p.value]),
    );
    return {
      schemeId: scheme.id,
      tag: scheme.tag,
      category: scheme.category,
      values: summary,
    };
  });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="tablist"
        aria-label="图表切换"
        className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-muted/50 p-1"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onSelect?.(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={`${active} 图表`}>
        {active === "radar" ? (
          <SchemeRadarChart
            series={radarSeries}
            title="多方案综合评分"
            description="Demo · 同输入同输出；选中方案保持高亮"
            height={300}
          />
        ) : null}
        {active === "bar" ? (
          <SchemeBarChart
            data={barData}
            paramKeys={paramKeys}
            selectedSchemeId={selectedSchemeId}
            title="核心参数对比"
            description={`以选中方案 ${selected?.tag ?? "推荐"} 为高亮`}
            height={300}
          />
        ) : null}
        {active === "heatmap" ? (
          <SensitivityHeatmapChart
            axes={[...run.sensitivity.axes]}
            cells={run.sensitivity.cells}
            title="参数敏感性热力图"
            description="行：参数 / 列：±15% 调整档位 / 颜色：评分变化"
            height={320}
          />
        ) : null}
      </div>
    </div>
  );
}

function dedupeParamKeys(scheme: Scheme | undefined): Array<{
  key: string;
  label: string;
  unit: string;
}> {
  if (!scheme) return [];
  return scheme.parameterSummary.map((p) => ({
    key: p.key,
    label: p.label,
    unit: p.unit,
  }));
}

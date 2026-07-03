"use client";

/**
 * 方案对比卡列表。
 *
 * 显示推荐 / 备选 / 风险三类方案。
 * 点击卡片切换当前方案，图表与详情面板联动。
 */

import { Check, ShieldAlert, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Scheme, SchemeScore } from "@/modules/parameter-planning/domain";

interface SchemeComparisonListProps {
  schemes: readonly Scheme[];
  selectedSchemeId: string;
  onSelectScheme: (schemeId: string) => void;
  className?: string;
}

const CATEGORY_TONE: Record<Scheme["category"], "primary" | "accent" | "warning"> = {
  recommended: "primary",
  alternative: "accent",
  risk: "warning",
};

const CATEGORY_ICON = {
  recommended: Sparkles,
  alternative: Check,
  risk: ShieldAlert,
};

const CATEGORY_BADGE: Record<Scheme["category"], "推荐" | "备选" | "不推荐"> = {
  recommended: "推荐",
  alternative: "备选",
  risk: "不推荐",
};

export function SchemeComparisonList({
  schemes,
  selectedSchemeId,
  onSelectScheme,
  className,
}: SchemeComparisonListProps) {
  return (
    <ul role="list" className={cn("flex flex-col gap-3", className)}>
      {schemes.map((scheme) => {
        const Icon = CATEGORY_ICON[scheme.category];
        const active = scheme.id === selectedSchemeId;
        const score = scheme.score;
        return (
          <li key={scheme.id}>
            <article
              className={cn(
                "group flex flex-col gap-3 rounded-lg border bg-surface p-4 transition-all duration-base",
                active
                  ? "border-primary/60 shadow-md ring-1 ring-primary/20"
                  : "border-border hover:border-border-strong",
              )}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-md border",
                        scheme.category === "recommended"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : scheme.category === "alternative"
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-warning/40 bg-warning/10 text-warning",
                      )}
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-base font-semibold leading-tight text-foreground">
                      {scheme.label}
                    </h3>
                    <Badge tone={CATEGORY_TONE[scheme.category]} size="sm">
                      {CATEGORY_BADGE[scheme.category]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {scheme.applicability}
                  </p>
                </div>
                <ScoreCluster score={score} />
              </header>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {scheme.parameterSummary.map((p) => (
                  <div
                    key={p.key}
                    className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-2.5 py-1.5"
                  >
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {p.label}
                    </span>
                    <span className="tabular text-sm font-medium text-foreground">
                      {p.value.toFixed(2)} <span className="text-[10px] text-muted-foreground">{p.unit}</span>
                    </span>
                  </div>
                ))}
              </div>

              {scheme.risks.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <ShieldAlert className="h-3 w-3" aria-hidden />
                    风险
                  </span>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {scheme.risks.slice(0, 3).map((risk) => (
                      <li
                        key={risk}
                        className="flex items-start gap-1.5"
                      >
                        <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {scheme.note ? (
                <div className="flex items-start gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Badge tone="outline" size="sm">说明</Badge>
                  <span>{scheme.note}</span>
                </div>
              ) : null}

              <footer className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  评分综合 {Math.round(score.overall)} · Demo 模拟
                </span>
                <Button
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  onClick={() => onSelectScheme(scheme.id)}
                  aria-pressed={active}
                >
                  {active ? "已选中" : "查看详情"}
                </Button>
              </footer>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function ScoreCluster({ score }: { score: SchemeScore }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        综合
      </span>
      <span className="tabular text-3xl font-semibold leading-none text-foreground">
        {Math.round(score.overall)}
      </span>
      <span className="flex gap-1 text-[10px] text-muted-foreground">
        <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
          安 {Math.round(score.safety)}
        </span>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">
          适 {Math.round(score.suitability)}
        </span>
        <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
          经 {Math.round(score.economy)}
        </span>
      </span>
    </div>
  );
}

export function SchemeSelectionDisabledHint() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
      <X className="h-3.5 w-3.5" aria-hidden />
      当前 Run 没有可用方案；请调整输入或解除阻断条件后重新规划。
    </div>
  );
}

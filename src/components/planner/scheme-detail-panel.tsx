"use client";

/**
 * 执行摘要 / 风险 / 人工复核面板（详情列）。
 */

import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ShieldCheck,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/feedback/risk-badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  CONFIDENCE_LABEL,
  SOURCE_LABEL,
  type PlanningRun,
  type PredictedParameter,
  type ReviewRequirement,
  type RiskItem,
  type Scheme,
} from "@/modules/parameter-planning/domain";

interface SchemeDetailPanelProps {
  run: PlanningRun;
  scheme: Scheme | undefined;
  /** 当前步骤选择（Mobile / Desktop 共用） */
  className?: string;
}

export function SchemeDetailPanel({
  run,
  scheme,
  className,
}: SchemeDetailPanelProps) {
  return (
    <aside
      aria-label="执行摘要与方案详情"
      className={cn(
        "flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 lg:gap-8 lg:p-5",
        className,
      )}
    >
      <RunSummary run={run} />
      {scheme ? (
        <>
          <PredictedParameterTable scheme={scheme} />
          <ReviewsBlock reviews={run.reviews} />
          <RisksBlock risks={run.risks} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          当前 Run 没有方案被选中。请等待 Workflow 完成或人工取消后重新规划。
        </p>
      )}
    </aside>
  );
}

function RunSummary({ run }: { run: PlanningRun }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible
      title="执行摘要"
      icon={WorkflowIcon}
      open={open}
      onToggle={() => setOpen((p) => !p)}
      meta={
        run.status === "blocked" ? (
          <RiskBadge level="high" />
        ) : run.status === "awaiting_review" ? (
          <RiskBadge level="medium" />
        ) : run.status === "succeeded" ? (
          <Badge tone="success" size="sm">已完成</Badge>
        ) : (
          <Badge tone="primary" size="sm">执行中</Badge>
        )
      }
    >
      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Run id</span>
          <span className="tabular text-foreground">{run.id}</span>
        </div>
        <div className="flex justify-between">
          <span>创建时间</span>
          <span className="tabular text-foreground">{formatDateTime(run.createdAt)}</span>
        </div>
        {run.completedAt ? (
          <div className="flex justify-between">
            <span>完成时间</span>
            <span className="tabular text-foreground">{formatDateTime(run.completedAt)}</span>
          </div>
        ) : null}
        {run.blockedReason ? (
          <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-danger">
            <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{run.blockedReason}</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
          <SummaryStat label="孔距 a" value={`${run.normalized.holeSpacing.toFixed(2)} m`} />
          <SummaryStat label="排距 b" value={`${run.normalized.rowSpacing.toFixed(2)} m`} />
          <SummaryStat label="抵抗线 w" value={`${run.normalized.burdenDistance.toFixed(2)} m`} />
          <SummaryStat label="装药结构" value={run.normalized.chargeStructure} />
          <SummaryStat
            label="最大单响"
            value={`${run.normalized.maxChargePerDelay} kg`}
          />
          <SummaryStat
            label="允许振速"
            value={`${run.normalized.peakParticleVelocity} cm/s`}
          />
        </div>
      </div>
    </Collapsible>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="tabular text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function PredictedParameterTable({ scheme }: { scheme: Scheme }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible
      title={`方案参数 · ${scheme.tag}`}
      icon={ShieldCheck}
      open={open}
      onToggle={() => setOpen((p) => !p)}
    >
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5">参数</th>
              <th className="px-2 py-1.5 text-right">值</th>
              <th className="px-2 py-1.5 text-right">区间</th>
              <th className="px-2 py-1.5">来源</th>
              <th className="px-2 py-1.5">风险</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {scheme.predictedParameters.map((p) => (
              <tr key={p.key} className="border-t border-border/60">
                <td className="px-2 py-1.5">
                  <div className="flex flex-col">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.key}
                    </span>
                  </div>
                </td>
                <td className="tabular px-2 py-1.5 text-right">
                  {p.value.toFixed(2)} <span className="text-[10px] text-muted-foreground">{p.unit}</span>
                </td>
                <td className="tabular px-2 py-1.5 text-right text-[10px] text-muted-foreground">
                  {p.range.min.toFixed(2)} ~ {p.range.max.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-[10px]">
                  <SourceBadge param={p} />
                </td>
                <td className="px-2 py-1.5 text-[10px]">
                  {p.requiresReview ? (
                    <Badge tone="warning" size="sm">
                      需复核
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Collapsible>
  );
}

function SourceBadge({ param }: { param: PredictedParameter }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge
        tone={
          param.sourceKind === "rule" ? "primary" :
          param.sourceKind === "human" ? "accent" :
          param.sourceKind === "model-placeholder" ? "warning" :
          "neutral"
        }
        size="sm"
      >
        {SOURCE_LABEL[param.sourceKind]}
      </Badge>
      <span className="text-[10px] text-muted-foreground">
        置信 {CONFIDENCE_LABEL[param.confidenceLevel]}
      </span>
    </div>
  );
}

function ReviewsBlock({ reviews }: { reviews: readonly ReviewRequirement[] }) {
  const [open, setOpen] = useState(true);
  if (reviews.length === 0) {
    return (
      <Collapsible
        title="人工重点确认"
        icon={ClipboardCheck}
        open={open}
        onToggle={() => setOpen((p) => !p)}
      >
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          当前 Run 无需人工确认；所有参数已通过规则预检。
        </div>
      </Collapsible>
    );
  }
  return (
    <Collapsible
      title={`人工重点确认（${reviews.length}）`}
      icon={ClipboardCheck}
      open={open}
      onToggle={() => setOpen((p) => !p)}
    >
      <ul className="flex flex-col gap-2">
        {reviews.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex items-start gap-2 rounded-md border p-2 text-xs",
              r.level === "high"
                ? "border-danger/40 bg-danger/5 text-danger"
                : r.level === "medium"
                  ? "border-warning/40 bg-warning/5 text-warning"
                  : "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div className="flex flex-col">
              <span className="text-foreground">
                {r.paramKey ?? r.schemeId ?? r.id}
              </span>
              <span className="text-[11px]">{r.reason}</span>
            </div>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}

function RisksBlock({ risks }: { risks: readonly RiskItem[] }) {
  const [open, setOpen] = useState(true);
  if (risks.length === 0) {
    return (
      <Collapsible
        title="风险清单"
        icon={ShieldCheck}
        open={open}
        onToggle={() => setOpen((p) => !p)}
      >
        <div className="rounded-md border border-success/40 bg-success/5 p-3 text-xs text-success">
          当前 Run 未识别到新增风险。
        </div>
      </Collapsible>
    );
  }
  return (
    <Collapsible
      title={`风险清单（${risks.length}）`}
      icon={ShieldCheck}
      open={open}
      onToggle={() => setOpen((p) => !p)}
    >
      <ul className="flex flex-col gap-2">
        {risks.slice(0, 8).map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex items-start gap-2 rounded-md border p-2 text-xs",
              r.level === "high"
                ? "border-danger/40 bg-danger/5"
                : r.level === "medium"
                  ? "border-warning/40 bg-warning/5"
                  : "border-border bg-muted/30",
            )}
          >
            <RiskBadge level={r.level} />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">
                {r.title}
              </span>
              <span className="text-muted-foreground">{r.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}

function Collapsible({
  title,
  icon: Icon,
  meta,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof WorkflowIcon;
  meta?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {meta ? <span className="ml-2">{meta}</span> : null}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open ? children : null}
    </section>
  );
}

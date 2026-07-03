"use client";

/**
 * 参数规划工作台主客户端组件。
 *
 * Desktop：
 *   - 左侧：场景表单（含预设）
 *   - 中部：方案对比 / 图表 / 执行时间线
 *   - 右侧：详情面板 / 风险 / 人工复核
 * Mobile：
 *   - 步骤式：场景输入 → 参数确认 → 执行规划 → 方案对比 → 风险与确认
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  ClipboardList,
  PlayCircle,
  Repeat,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/error-state";
import { RiskBadge } from "@/components/feedback/risk-badge";
import { SectionHeader } from "@/components/feedback/section-header";
import { cn } from "@/lib/cn";

import {
  type BlastScenarioInput,
  type PlanningRun,
  type ScenarioPreset,
  type Scheme,
  SCENARIO_PRESETS,
  blastScenarioInputSchema,
} from "@/modules/parameter-planning/domain";

import { EngineeringScenarioForm } from "./engineering-scenario-form";
import { SchemeComparisonList } from "./scheme-comparison-list";
import { SchemeDetailPanel } from "./scheme-detail-panel";
import {
  ExecutionCallout,
  PlanningStepTimeline,
} from "./planning-step-timeline";
import { PlannerChartTabs, type PlannerChartKey } from "./planner-chart-tabs";
import { usePlanningExecution } from "./use-planning-execution";
import { useSelectionStore, usePlannerUIStore } from "@/stores/planner-store";

interface PlannerWorkbenchProps {
  /** Server side, optional initial preset id from URL */
  initialPresetId?: ScenarioPreset["id"];
}

const MOBILE_STEPS: Array<{
  key: "scenario" | "params" | "execute" | "schemes" | "risks";
  label: string;
  description: string;
}> = [
  { key: "scenario", label: "场景输入", description: "选择预设并填写表单。" },
  { key: "params", label: "参数确认", description: "检查标准化与预检结果。" },
  { key: "execute", label: "执行规划", description: "点击启动，逐步查看时间线。" },
  { key: "schemes", label: "方案对比", description: "推荐 / 备选 / 风险多维度比较。" },
  { key: "risks", label: "风险与确认", description: "人工复核点列表与阻断提示。" },
];

export function PlannerWorkbench({ initialPresetId }: PlannerWorkbenchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const presetIdFromUrl = (searchParams.get("preset") as ScenarioPreset["id"] | null) ?? initialPresetId ?? null;
  const selectedSchemeIdFromUrl = searchParams.get("scheme");
  const chartFromUrl = (searchParams.get("chart") as PlannerChartKey | null) ?? null;

  const [activePresetId, setActivePresetId] = useState<ScenarioPreset["id"] | null>(presetIdFromUrl ?? "standard");

  const initialInput = useMemo<BlastScenarioInput>(() => {
    const preset = SCENARIO_PRESETS.find((p) => p.id === activePresetId);
    return preset ? preset.input : (SCENARIO_PRESETS[0]?.input ?? ({} as BlastScenarioInput));
  }, [activePresetId]);

  const { state, start, cancel, reset } = usePlanningExecution({
    stepDurationMs: 520,
  });

  const setSelected = useSelectionStore((s) => s.setSelectedSchemeId);
  const mobileStep = usePlannerUIStore((s) => s.mobileStep);
  const setMobileStep = usePlannerUIStore((s) => s.setMobileStep);
  const chart = usePlannerUIStore((s) => s.chart);
  const setChart = usePlannerUIStore((s) => s.setChart);

  /** 当前 run（可能为空） */
  const run = state.run;

  /** 当前选中方案（run 出来后默认推荐；用户可切换） */
  const selectedSchemeId = useSelectionStore((s) => {
    if (run && run.schemeSet.schemes.some((sch) => sch.id === s.selectedSchemeId)) {
      return s.selectedSchemeId;
    }
    return run?.selectedSchemeId ?? null;
  });

  useEffect(() => {
    if (selectedSchemeIdFromUrl && run?.schemeSet.schemes.some((s) => s.id === selectedSchemeIdFromUrl)) {
      setSelected(selectedSchemeIdFromUrl);
    }
  }, [selectedSchemeIdFromUrl, run, setSelected]);

  useEffect(() => {
    if (chartFromUrl) setChart(chartFromUrl);
  }, [chartFromUrl, setChart]);

  /** 同步 activePresetId → URL */
  useEffect(() => {
    if (!activePresetId) return;
    if (searchParams.get("preset") === activePresetId) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("preset", activePresetId);
    router.replace(`/planner?${next.toString()}`, { scroll: false });
  }, [activePresetId, router, searchParams]);

  /** 同步 selectedSchemeId → URL */
  useEffect(() => {
    if (!run) return;
    if (selectedSchemeId === searchParams.get("scheme")) return;
    const next = new URLSearchParams(searchParams.toString());
    if (selectedSchemeId) next.set("scheme", selectedSchemeId);
    else next.delete("scheme");
    router.replace(`/planner?${next.toString()}`, { scroll: false });
  }, [selectedSchemeId, run, router, searchParams]);

  /** 同步 chart → URL */
  useEffect(() => {
    if (chart === searchParams.get("chart")) return;
    const next = new URLSearchParams(searchParams.toString());
    if (chart) next.set("chart", chart);
    else next.delete("chart");
    router.replace(`/planner?${next.toString()}`, { scroll: false });
  }, [chart, router, searchParams]);

  const handleSelectPreset = useCallback(
    (preset: ScenarioPreset) => {
      setActivePresetId(preset.id);
      reset();
      setSelected(null);
    },
    [reset, setSelected],
  );

  const handleSubmit = useCallback(
    (input: BlastScenarioInput) => {
      const verified = blastScenarioInputSchema.parse(input);
      start({
        input: verified,
        presetId: activePresetId ?? undefined,
      });
      setMobileStep(2);
    },
    [activePresetId, setMobileStep, start],
  );

  const selectedScheme = useMemo(() => {
    if (!run) return undefined;
    return (
      run.schemeSet.schemes.find((s) => s.id === selectedSchemeId) ??
      run.schemeSet.schemes.find((s) => s.category === "recommended") ??
      run.schemeSet.schemes[0]
    );
  }, [run, selectedSchemeId]);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PlannerSafetyNotice />

      <MobileStepper
        step={mobileStep}
        setStep={setMobileStep}
        runCreated={Boolean(run)}
      />

      <div className="flex flex-col gap-6 lg:hidden">
        <MobileSection
          title={MOBILE_STEPS[0]!.label}
          description={MOBILE_STEPS[0]!.description}
          visible={mobileStep === 0}
        >
          <EngineeringScenarioForm
            defaultInput={initialInput}
            onSubmit={handleSubmit}
            onSelectPreset={handleSelectPreset}
            selectedPresetId={activePresetId ?? undefined}
            submitting={state.phase === "running"}
            compact
          />
        </MobileSection>

        <MobileSection
          title={MOBILE_STEPS[1]!.label}
          description={MOBILE_STEPS[1]!.description}
          visible={mobileStep === 1}
        >
          {run ? (
            <NormalizedView run={run} />
          ) : (
            <ErrorState
              title="暂无归一化结果"
              description="请先在上一步点击「启动规划」。"
            />
          )}
        </MobileSection>

        <MobileSection
          title={MOBILE_STEPS[2]!.label}
          description={MOBILE_STEPS[2]!.description}
          visible={mobileStep === 2}
        >
          <ExecuteSection
            state={state}
            onStart={() =>
              start({
                input: initialInput,
                presetId: activePresetId ?? undefined,
              })
            }
            onCancel={cancel}
            onReset={() => {
              reset();
              setSelected(null);
            }}
            hasRun={Boolean(run)}
          />
        </MobileSection>

        <MobileSection
          title={MOBILE_STEPS[3]!.label}
          description={MOBILE_STEPS[3]!.description}
          visible={mobileStep === 3}
        >
          {run ? (
            <SchemesSection
              run={run}
              selectedSchemeId={selectedSchemeId}
              onSelectScheme={(id) => setSelected(id)}
              chart={chart}
              onChartChange={(c) => setChart(c)}
            />
          ) : (
            <ErrorState title="请先执行规划" description="回到上一步启动一次 Workflow。" />
          )}
        </MobileSection>

        <MobileSection
          title={MOBILE_STEPS[4]!.label}
          description={MOBILE_STEPS[4]!.description}
          visible={mobileStep === 4}
        >
          {run ? (
            <SchemeDetailPanel run={run} scheme={selectedScheme} />
          ) : (
            <ErrorState title="尚未生成结果" description="请先回到第 3 步执行 Workflow。" />
          )}
        </MobileSection>

        <MobileNavControls
          step={mobileStep}
          setStep={setMobileStep}
          canAdvance={Boolean(run)}
          canPrev={mobileStep > 0}
        />
      </div>

      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
        <section
          aria-label="工程条件与场景输入"
          className="flex flex-col gap-4 lg:col-span-4"
        >
          <Card padding="lg" className="gap-4">
            <header className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                工程条件与场景输入
              </h2>
              <p className="text-xs text-muted-foreground">
                填写 Demo 工程条件或选择预设；草稿会自动保存到本机。
              </p>
            </header>
            <EngineeringScenarioForm
              defaultInput={initialInput}
              onSubmit={handleSubmit}
              onSelectPreset={handleSelectPreset}
              selectedPresetId={activePresetId ?? undefined}
              submitting={state.phase === "running"}
            />
          </Card>

          <ExecuteSection
            state={state}
            onStart={() =>
              start({
                input: initialInput,
                presetId: activePresetId ?? undefined,
              })
            }
            onCancel={cancel}
            onReset={() => {
              reset();
              setSelected(null);
            }}
            hasRun={Boolean(run)}
          />
        </section>

        <section
          aria-label="参数与方案可视化"
          className="flex flex-col gap-6 lg:col-span-5"
        >
          <SchemesSection
            run={run}
            selectedSchemeId={selectedSchemeId}
            onSelectScheme={(id) => setSelected(id)}
            chart={chart}
            onChartChange={(c) => setChart(c)}
          />

          {run ? <NormalizedView run={run} compact /> : null}
        </section>

        <section
          aria-label="执行摘要、风险与下一步"
          className="flex flex-col gap-4 lg:col-span-3"
        >
          <RunSummarySidebar
            state={state}
            selectedScheme={selectedScheme}
            run={run}
          />
        </section>
      </div>
    </div>
  );
}

/* ----------------- 公共组件 ----------------- */

function PlannerSafetyNotice() {
  return (
    <div
      role="note"
      aria-label="Demo 预测与安全提示"
      className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning sm:flex-row sm:items-start sm:gap-3"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <span>
        所有参数预测与方案评分均为 Demo 模拟数据；最终装药、孔网、延期与安全距离不得作为现场施工指令，
        必须由具备资质的专业工程师复核并签字。
      </span>
    </div>
  );
}

function MobileStepper({
  step,
  setStep,
  runCreated,
}: {
  step: number;
  setStep: (n: number) => void;
  runCreated: boolean;
}) {
  return (
    <ol
      className="flex w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface p-2 lg:hidden"
      aria-label="Mobile 进度"
    >
      {MOBILE_STEPS.map((s, idx) => {
        const completed = runCreated ? idx <= 3 : idx < 0;
        const active = idx === step;
        return (
          <li key={s.key} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => setStep(idx)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : completed
                    ? "bg-success/10 text-success"
                    : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]">
                <span
                  className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded-full",
                    active
                      ? "bg-primary text-primary-foreground"
                      : completed
                        ? "bg-success text-primary-foreground"
                        : "border border-border bg-surface text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <span>{s.label}</span>
              </span>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                {s.description}
              </span>
            </button>
            {idx < MOBILE_STEPS.length - 1 ? (
              <span className="mx-1 h-px w-3 shrink-0 bg-border" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function MobileSection({
  title,
  description,
  visible,
  children,
}: {
  title: string;
  description: string;
  visible: boolean;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      aria-label={title}
    >
      <header className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function MobileNavControls({
  step,
  setStep,
  canAdvance,
  canPrev,
}: {
  step: number;
  setStep: (n: number) => void;
  canAdvance: boolean;
  canPrev: boolean;
}) {
  const atEnd = step === MOBILE_STEPS.length - 1;
  return (
    <div className="flex items-center justify-between gap-2 lg:hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setStep(Math.max(0, step - 1))}
        disabled={!canPrev}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> 上一步
      </Button>
      <span className="text-xs text-muted-foreground">
        第 {step + 1} / {MOBILE_STEPS.length} 步
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setStep(Math.min(MOBILE_STEPS.length - 1, step + 1))}
        disabled={!canAdvance || atEnd}
      >
        下一步 <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

function ExecuteSection({
  state,
  onStart,
  onCancel,
  onReset,
  hasRun,
}: {
  state: ReturnType<typeof usePlanningExecution>["state"];
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
  hasRun: boolean;
}) {
  return (
    <section
      aria-label="执行体验"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <SectionHeader
          title="执行规划"
          description="点击启动，按真实步骤状态推进；高风险场景会被 Safety Reviewer 阻断。"
        />
      </header>

      <ExecutionCallout phase={state.phase} blockedReason={state.run?.blockedReason} />

      <PlanningStepTimeline steps={state.steps} />

      <div className="flex flex-wrap items-center gap-2">
        {!hasRun || state.phase === "idle" || state.phase === "cancelled" || state.phase === "failed" ? (
          <Button
            size="sm"
            variant="primary"
            onClick={onStart}
            loading={state.phase === "running"}
          >
            <PlayCircle className="h-4 w-4" aria-hidden /> 启动规划
          </Button>
        ) : null}
        {state.phase === "running" ? (
          <Button size="sm" variant="outline" onClick={onCancel}>
            <CircleSlash className="h-4 w-4" aria-hidden /> 取消
          </Button>
        ) : null}
        {hasRun && state.phase !== "running" ? (
          <Button size="sm" variant="ghost" onClick={onReset}>
            <Repeat className="h-4 w-4" aria-hidden /> 重置
          </Button>
        ) : null}
        {state.error ? (
          <Badge tone="danger" size="sm">
            {state.error}
          </Badge>
        ) : null}
      </div>
    </section>
  );
}

function NormalizedView({
  run,
  compact,
}: {
  run: PlanningRun;
  compact?: boolean;
}) {
  return (
    <section
      aria-label="参数归一化结果"
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <SectionHeader
          title="标准化工程条件"
          description="由归一化规则确定性派生；不展示具体现场控制参数。"
        />
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="工程类型" value={run.normalized.engineeringTypeLabel} />
        <Stat label="岩体类别" value={run.normalized.rockCategoryLabel} />
        <Stat label="普氏系数 f" value={`${run.normalized.protodyakonov}`} />
        <Stat label="台阶高度" value={`${run.normalized.benchHeight.toFixed(1)} m`} />
        <Stat label="孔径" value={`${run.normalized.holeDiameter} mm`} />
        <Stat label="孔深" value={`${run.normalized.holeDepth.toFixed(1)} m`} />
        <Stat label="堵塞长度" value={`${run.normalized.stemmingLength.toFixed(2)} m`} />
        <Stat label="孔距 a" value={`${run.normalized.holeSpacing.toFixed(2)} m`} />
        <Stat label="排距 b" value={`${run.normalized.rowSpacing.toFixed(2)} m`} />
        <Stat label="抵抗线 w" value={`${run.normalized.burdenDistance.toFixed(2)} m`} />
        <Stat label="装药结构" value={run.normalized.chargeStructure} />
        <Stat
          label="最大单响"
          value={`${run.normalized.maxChargePerDelay} kg`}
        />
      </div>
      {compact ? null : (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          所有数值均为 Demo 模拟；不允许直接用于现场控制与施工指令。
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-2.5 py-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="tabular text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function SchemesSection({
  run,
  selectedSchemeId,
  onSelectScheme,
  chart,
  onChartChange,
}: {
  run: PlanningRun | null;
  selectedSchemeId: string | null;
  onSelectScheme: (id: string) => void;
  chart: PlannerChartKey;
  onChartChange: (key: PlannerChartKey) => void;
}) {
  if (!run) {
    return (
      <ErrorState
        title="等待 Workflow 完成"
        description="执行规划后此处展示推荐 / 备选 / 风险方案对比与图表。"
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="方案对比"
          description="同一输入下的多方案对照；选中后图表联动。"
        />
        <SchemeComparisonList
          schemes={run.schemeSet.schemes}
          selectedSchemeId={selectedSchemeId ?? run.schemeSet.recommendedId}
          onSelectScheme={onSelectScheme}
        />
      </section>
      <PlannerChartTabs
        run={run}
        selectedSchemeId={selectedSchemeId ?? run.schemeSet.recommendedId}
        active={chart}
        onSelect={(k) => onChartChange(k)}
      />
    </div>
  );
}

function RunSummarySidebar({
  state,
  selectedScheme,
  run,
}: {
  state: ReturnType<typeof usePlanningExecution>["state"];
  selectedScheme: Scheme | undefined;
  run: PlanningRun | null;
}) {
  if (!run) {
    return (
      <Card padding="lg" tone="muted">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">执行摘要</h3>
            <p className="text-xs text-muted-foreground">
              Workflow 完成时此处显示 Run 状态、推荐方案、风险清单与人工复核条目。
            </p>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <>
      <Card padding="lg" className="gap-2">
        <header className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
            执行摘要
          </h3>
          {run.status === "blocked" ? (
            <RiskBadge level="high" />
          ) : (
            <Badge
              tone={
                run.status === "succeeded"
                  ? "success"
                  : run.status === "awaiting_review"
                    ? "warning"
                    : "primary"
              }
              size="sm"
            >
              {run.status}
            </Badge>
          )}
        </header>
        <p className="text-xs text-muted-foreground">
          {run.status === "blocked"
            ? run.blockedReason ?? "Safety Reviewer 已阻断，请处置后重试。"
            : run.status === "awaiting_review"
              ? "存在需人工补充的参数；可以重新规划或人工修改。"
              : "Workflow 已生成可比较的多方案，请切换对比。"}
        </p>
        {selectedScheme ? (
          <Button asChild size="sm" variant="ghost" className="self-start">
            <Link href={`/planner?scheme=${selectedScheme.id}`}>
              <ArrowUpRight className="h-4 w-4" aria-hidden /> 查看详情
            </Link>
          </Button>
        ) : null}
      </Card>
      <SchemeDetailPanel
        run={state.run ?? run}
        scheme={selectedScheme}
      />
    </>
  );
}

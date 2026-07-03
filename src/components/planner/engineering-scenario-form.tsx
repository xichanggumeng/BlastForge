"use client";

/**
 * 工程场景表单。
 *
 * 使用 React Hook Form + ZodResolver 校验；
 * - 字段说明、单位、必填校验；
 * - 自然语言补充（最长 800）；
 * - 支持自动保存草稿到 localStorage；
 * - 不使用浏览器 alert。
 */

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Sparkles, Upload, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/feedback/risk-badge";
import {
  blastScenarioInputSchema,
  type BlastScenarioInput,
  type ScenarioPreset,
  SCENARIO_PRESETS,
} from "@/modules/parameter-planning/domain";
import {
  FORM_FIELDS,
  FORM_GROUPS,
  ENGINEERING_OPTIONS,
  ROCK_OPTIONS,
  JOINT_OPTIONS,
  WATER_OPTIONS,
  ENVIRONMENT_OPTIONS,
  PROTECTION_OPTIONS,
  SENSITIVITY_OPTIONS,
  COST_OPTIONS,
  CONVENIENCE_OPTIONS,
  FLYROCK_OPTIONS,
  type FieldMeta,
} from "./form-fields";
import { cn } from "@/lib/cn";

const DRAFT_KEY = "blastforge.planner.draft";

export interface EngineeringScenarioFormProps {
  /** 当前表单默认值。Initial；表单受控显示。 */
  defaultInput?: BlastScenarioInput;
  /** 提交时执行（通常是 planDemo → repo） */
  onSubmit: (input: BlastScenarioInput) => void | Promise<void>;
  /** 选择预设场景 */
  onSelectPreset?: (preset: ScenarioPreset) => void;
  /** 是否处于提交中（按钮 loading） */
  submitting?: boolean;
  /** 当前已选预设 id */
  selectedPresetId?: string;
  /** 紧凑模式（用于右侧 / Mobile stepper） */
  compact?: boolean;
  /** 已存在运行 id 时禁用某些字段 */
  disabled?: boolean;
}

const NUMBER_FIELDS: ReadonlySet<FieldMeta["key"]> = new Set<FieldMeta["key"]>([
  "protodyakonov",
  "benchHeight",
  "holeDiameter",
  "holeDepth",
  "stemmingLength",
  "targetFragmentation",
  "peakParticleVelocity",
]);

export function EngineeringScenarioForm({
  defaultInput,
  onSubmit,
  onSelectPreset,
  submitting,
  selectedPresetId,
  compact,
  disabled,
}: EngineeringScenarioFormProps) {
  const initialDefault = useMemo(() => {
    if (defaultInput) return defaultInput;
    return SCENARIO_PRESETS[0]?.input;
  }, [defaultInput]);

  const form = useForm<BlastScenarioInput>({
    resolver: zodResolver(blastScenarioInputSchema),
    defaultValues: initialDefault as BlastScenarioInput,
    mode: "onBlur",
  });

  /** 表单已 mounted 后从草稿恢复 */
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || draftLoaded) return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const verified = blastScenarioInputSchema.safeParse(parsed);
        if (verified.success) {
          form.reset(verified.data);
        }
      }
    } catch {
      /* noop */
    }
    setDraftLoaded(true);
  }, [draftLoaded, form]);

  /** 监听 defaultInput 变化，外部切换预设时同步 */
  useEffect(() => {
    if (defaultInput) form.reset(defaultInput);
  }, [defaultInput, form]);

  /** Watch values for draft saving */
  const watched = form.watch();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!draftLoaded) return;
    try {
      const parsed = blastScenarioInputSchema.safeParse(watched);
      if (parsed.success) {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(parsed.data));
      }
    } catch {
      /* noop */
    }
  }, [watched, draftLoaded]);

  const onFormSubmit = form.handleSubmit(
    async (values) => {
      const verified = blastScenarioInputSchema.parse(values);
      await onSubmit(verified);
    },
    (errors) => {
      // 校验失败时记录到控制台，便于移动端 / 桌面端排查；
      // RHF 会同时把错误写入字段 state，表单已自动展示 inline error。
      if (typeof window !== "undefined") {
        console.warn("[EngineeringScenarioForm] validation failed:", Object.keys(errors));
      }
    },
  );

  const grouped = useMemo(() => {
    const map: Record<FieldMeta["group"], FieldMeta[]> = {
      scenario: [],
      env: [],
      cost: [],
      demo: [],
    };
    for (const f of FORM_FIELDS) {
      if (compact && f.group === "demo" && !fieldHasValue(form.watch(), f.key))
        continue;
      map[f.group].push(f);
    }
    return map;
  }, [compact, form]);

  return (
    <form
      onSubmit={onFormSubmit}
      className={cn(
        "flex flex-col gap-4",
        compact ? "text-sm" : "text-sm",
      )}
      noValidate
    >
      <fieldset disabled={disabled || submitting} className="flex flex-col gap-5">
        <PresetPicker
          selectedPresetId={selectedPresetId}
          onSelectPreset={onSelectPreset}
          compact={compact}
        />

        {FORM_GROUPS.filter((g) => grouped[g.key].length > 0).map((group) => (
          <section
            key={group.key}
            className="flex flex-col gap-3"
            aria-labelledby={`form-group-${group.key}`}
          >
            <header className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <h3
                  id={`form-group-${group.key}`}
                  className="text-sm font-semibold text-foreground"
                >
                  {group.label}
                </h3>
                {group.key === "demo" ? (
                  <Badge tone="accent" size="sm">
                    Demo 模拟
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {group.description}
              </p>
            </header>
            <div
              className={cn(
                "grid gap-3",
                compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
              )}
            >
              {grouped[group.key].map((field) => (
                <Controller
                  key={field.key}
                  control={form.control}
                  name={field.key as keyof BlastScenarioInput}
                  render={({ field: rhfField, fieldState }) => (
                    <FormFieldRenderer
                      meta={field}
                      rhfField={rhfField}
                      error={fieldState.error?.message}
                      compact={compact}
                    />
                  )}
                />
              ))}
            </div>
          </section>
        ))}
      </fieldset>

      <footer className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            try {
              window.localStorage.removeItem(DRAFT_KEY);
            } catch {
              /* noop */
            }
            const fallback = SCENARIO_PRESETS[0]?.input;
            if (fallback) form.reset(fallback);
          }}
          disabled={submitting}
          aria-label="重置为标准预设"
        >
          清空草稿
        </Button>
        <div className="flex items-center gap-2">
          {draftLoaded ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Save className="h-3.5 w-3.5" aria-hidden />
              草稿已自动保存
            </span>
          ) : null}
          <Button
            type="button"
            variant="primary"
            loading={submitting}
            disabled={disabled}
            onClick={() => {
              // 显式触发 RHF 校验 + onValid，避免任何浏览器原生 form submission
              // 路径在某些环境下被异常触发（移动端 / 表单嵌套等）。
              void onFormSubmit();
            }}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            启动规划
          </Button>
        </div>
      </footer>
    </form>
  );
}

function fieldHasValue(values: BlastScenarioInput, key: FieldMeta["key"]): boolean {
  const v = values[key as keyof BlastScenarioInput];
  if (v === undefined || v === null || v === "") return false;
  return true;
}

function PresetPicker({
  selectedPresetId,
  onSelectPreset,
  compact,
}: {
  selectedPresetId?: string;
  onSelectPreset?: (preset: ScenarioPreset) => void;
  compact?: boolean;
}) {
  return (
    <section
      aria-labelledby="preset-picker-title"
      className="flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3
            id="preset-picker-title"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <Wand2 className="h-4 w-4 text-primary" aria-hidden />
            预设场景
          </h3>
          <p className="text-xs text-muted-foreground">
            点击预设即可填充表单并展示该场景的能力。
          </p>
        </div>
      </header>
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {SCENARIO_PRESETS.map((preset) => {
          const active = selectedPresetId === preset.id;
          const tone: "primary" | "accent" | "warning" =
            preset.id === "standard" ? "primary" :
            preset.id === "complex" ? "accent" : "warning";
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              aria-label={`选择预设：${preset.name}`}
              onClick={() => onSelectPreset?.(preset)}
              className={cn(
                "group flex flex-col items-start gap-2 rounded-lg border bg-surface p-3 text-left transition-colors",
                "hover:border-border-strong hover:bg-muted/40",
                active
                  ? "border-primary/50 bg-primary/5"
                  : "border-border",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <Badge tone={tone} size="sm">
                  {preset.shortLabel}
                </Badge>
                {active ? (
                  <Badge tone="success" size="sm">
                    已选择
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                  {preset.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {preset.description}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                {preset.highlight.slice(0, 2).map((h) => (
                  <li
                    key={h}
                    className="rounded-full border border-border bg-surface px-2 py-0.5"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface FormFieldRendererProps {
  meta: FieldMeta;
  /** 类型从 Controller 推断而来，但通过 `any` 桥接以避免与 input/output 泛型错位 */
  rhfField: ControllerRenderField;
  error?: string;
  compact?: boolean;
}

/** 桥接类型：与 RHF Controller 的 `field` 渲染属性兼容 */
type ControllerRenderField = {
  name: string;
  onBlur: () => void;
  onChange: (...args: unknown[]) => void;
  ref: React.Ref<unknown>;
  value: unknown;
  disabled?: boolean;
};

function FormFieldRenderer({
  meta,
  rhfField,
  error,
  compact,
}: FormFieldRendererProps) {
  const id = `planner-field-${meta.key}`;
  const describeId = `${id}-desc`;

  const labelEl = (
    <label
      htmlFor={id}
      className="flex items-center gap-1.5 text-xs font-medium text-foreground"
    >
      <span>{meta.label}</span>
      {meta.required ? (
        <span aria-label="必填" className="text-danger">*</span>
      ) : null}
      {meta.isDemo ? (
        <Badge tone="accent" size="sm">
          Demo
        </Badge>
      ) : null}
      {meta.unit ? (
        <span className="text-[10px] text-muted-foreground">({meta.unit})</span>
      ) : null}
    </label>
  );

  const descriptionEl = meta.description ? (
    <p id={describeId} className="text-[11px] text-muted-foreground">
      {meta.description}
    </p>
  ) : null;

  const errorEl = error ? (
    <p role="alert" className="text-[11px] text-danger">
      {error}
    </p>
  ) : null;

  /** 选项枚举映射 */
  const selectOptions = useMemo(() => {
    switch (meta.key) {
      case "engineeringType":
        return ENGINEERING_OPTIONS;
      case "rockCategory":
        return ROCK_OPTIONS;
      case "jointCondition":
        return JOINT_OPTIONS;
      case "waterCondition":
        return WATER_OPTIONS;
      case "constructionEnvironment":
        return ENVIRONMENT_OPTIONS;
      case "protectionTarget":
        return PROTECTION_OPTIONS;
      case "environmentSensitivity":
        return SENSITIVITY_OPTIONS;
      case "costPreference":
        return COST_OPTIONS;
      case "convenienceRequirement":
        return CONVENIENCE_OPTIONS;
      case "flyrockRisk":
        return FLYROCK_OPTIONS;
      default:
        return null;
    }
  }, [meta.key]);

  const isTextarea = meta.key === "freeTextNotes";
  const isNumber = NUMBER_FIELDS.has(meta.key);

  /** 解构出 ref：避免 generic 推断把 Ref<unknown> 注入到 DOM 元素 */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ref: _rhfRef, ...rhfProps } = rhfField as ControllerRenderField & {
    ref?: React.Ref<unknown>;
  };

  return (
    <div className="flex flex-col gap-1.5">
      {labelEl}
      {descriptionEl}
      {selectOptions ? (
        <select
          {...rhfProps}
          id={id}
          value={String(rhfField.value ?? "")}
          aria-describedby={describeId}
          className={cn(
            "w-full appearance-none rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "h-9 py-1" : "h-10 py-2",
            error && "border-danger/50",
          )}
        >
          {selectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : isTextarea ? (
        <textarea
          {...rhfProps}
          id={id}
          value={String(rhfField.value ?? "")}
          aria-describedby={describeId}
          placeholder={meta.placeholder}
          rows={3}
          maxLength={800}
          className={cn(
            "w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            error && "border-danger/50",
          )}
        />
      ) : isNumber ? (
        <input
          {...rhfProps}
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          aria-describedby={describeId}
          placeholder={meta.placeholder}
          value={
            rhfField.value === undefined || rhfField.value === null
              ? ""
              : String(rhfField.value)
          }
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") {
              rhfField.onChange(undefined);
              return;
            }
            const n = Number(raw);
            rhfField.onChange(Number.isFinite(n) ? n : raw);
          }}
          className={cn(
            "tabular w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            compact ? "h-9" : "h-10",
            error && "border-danger/50",
          )}
        />
      ) : (
        <input
          {...rhfProps}
          id={id}
          type="text"
          aria-describedby={describeId}
          placeholder={meta.placeholder}
          value={String(rhfField.value ?? "")}
          className={cn(
            "w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            compact ? "h-9" : "h-10",
            error && "border-danger/50",
          )}
        />
      )}
      {meta.tip ? (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Upload className="h-3 w-3" aria-hidden /> {meta.tip}
        </p>
      ) : null}
      {errorEl}
    </div>
  );
}

export function RiskBadgeHint({
  level,
  label,
}: {
  level: "low" | "medium" | "high";
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RiskBadge level={level} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

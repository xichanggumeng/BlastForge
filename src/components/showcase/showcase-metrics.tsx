"use client";

import { motion, useReducedMotion } from "motion/react";

import { CountUp } from "@/components/motion/count-up";
import { cn } from "@/lib/cn";

const SHOWCASE_METRICS = [
  { label: "典型规划耗时", value: 3, suffix: " 分钟", digits: 0, hint: "从录入到推荐方案" },
  { label: "可解释引用", value: 86, suffix: "%", digits: 0, hint: "本周知识命中率" },
  { label: "运行 Agent", value: 8, suffix: "", digits: 0, hint: "专业 Agent 池规模" },
  { label: "Workflow 步骤", value: 10, suffix: "", digits: 0, hint: "主流程闭环" },
  { label: "人工复核节点", value: 2, suffix: "", digits: 0, hint: "Safety + 报告" },
  { label: "模拟方案库", value: 24, suffix: "", digits: 0, hint: "可对比推荐 / 备选" },
] as const;

export function ShowcaseMetrics({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="showcase-metrics-title"
      className={cn("flex flex-col gap-4", className)}
    >
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          核心价值指标
        </span>
        <h2
          id="showcase-metrics-title"
          className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
        >
          把规划、协同、复核交给一个可解释的工作流
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          以下数字为 Phase 2 模拟数据，用于向会议参与者传达平台规模与节奏；
          Phase 3 接入真实 Run 后将由 Provider Adapter 注入的指标自动替换。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SHOWCASE_METRICS.map((metric, idx) => (
          <motion.article
            key={metric.label}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, delay: idx * 0.05, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
          >
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {metric.label}
            </span>
            <span className="tabular text-2xl font-semibold leading-tight text-foreground">
              <CountUp
                value={metric.value}
                digits={metric.digits}
                suffix={metric.suffix}
                durationMs={1100}
              />
            </span>
            <span className="text-[11px] text-muted-foreground">{metric.hint}</span>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
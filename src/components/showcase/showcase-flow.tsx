"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/cn";

const STEPS = [
  {
    key: "input",
    label: "工程条件输入",
    description: "岩体、含水、环境、成本、自然语言说明",
    tone: "primary" as const,
    bullets: ["结构化参数 Schema", "自然语言补充", "单位自动归一"],
  },
  {
    key: "agent",
    label: "Agent 协作",
    description: "Normalizer · Retriever · Planner · Evaluator · Safety",
    tone: "accent" as const,
    bullets: ["工具白名单", "知识引用", "安全复核"],
  },
  {
    key: "scheme",
    label: "方案与报告",
    description: "推荐 / 备选 / 风险方案 · 知识引用 · 报告归档",
    tone: "success" as const,
    bullets: ["多方案对比", "人工复核", "报告归档"],
  },
];

const TONE_BG: Record<"primary" | "accent" | "success", string> = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  accent: "border-accent/40 bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
};

export function ShowcaseFlow({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="showcase-flow-title"
      className={cn("flex flex-col gap-5", className)}
    >
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          端到端工作流
        </span>
        <h2
          id="showcase-flow-title"
          className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
        >
          输入 → Agent 协作 → 方案与报告
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          BlastForge 把工程输入、多 Agent 协同、方案生成、人工复核和报告归档
          折叠为三段闭环，每段都有可解释的输入输出与责任边界。
        </p>
      </header>

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3" role="list">
        {STEPS.map((step, idx) => (
          <motion.li
            key={step.key}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md border font-mono text-sm font-semibold",
                  TONE_BG[step.tone],
                )}
                aria-hidden
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              {idx < STEPS.length - 1 ? (
                <ArrowRight
                  className="hidden h-4 w-4 text-muted-foreground md:block"
                  aria-hidden
                />
              ) : null}
            </div>
            <h3 className="text-base font-semibold text-foreground">{step.label}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
            <ul className="flex flex-wrap gap-1.5 text-[11px]">
              {step.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
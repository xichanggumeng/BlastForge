"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronRight, Compass, Cpu, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/motion/count-up";
import { ShowcaseAgentNetwork } from "./showcase-agent-network";
import { SHOWCASE_TOPOLOGY } from "./showcase-agent-topology";
import { cn } from "@/lib/cn";

const HERO_METRICS = [
  { label: "专业 Agent", value: 8, suffix: "" },
  { label: "Workflow 步骤", value: 10, suffix: "" },
  { label: "知识引用", value: 142, suffix: "" },
  { label: "推荐方案", value: 12, suffix: "" },
] as const;

const PILLARS = [
  {
    icon: Compass,
    title: "参数预测与方案规划",
    description:
      "输入工程条件 → 标准化 → 知识检索 → 参数预测 → 方案生成，每一步都基于工程语义和确定性计算。",
  },
  {
    icon: Cpu,
    title: "多 Agent 协同",
    description:
      "Supervisor 编排任务，Normalizer / Planner / Generator / Evaluator / Safety 各司其职，可追踪、可重放。",
  },
  {
    icon: Sparkles,
    title: "Agentic Workflow",
    description:
      "10 步主 Workflow 覆盖参数标准化、规则预检、人工复核与报告生成，每一步均接受规则与人工约束。",
  },
] as const;

export interface ShowcaseHeroProps {
  className?: string;
}

/**
 * Hero section of the showcase landing page. Server-rendered shells,
 * client-side animations, with a live Agent Network visualization on
 * the right column.
 */
export function ShowcaseHero({ className }: ShowcaseHeroProps) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="showcase-hero-title"
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-border bg-surface/60 px-6 py-12 lg:px-12 lg:py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] -z-10 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-[-5%] -z-10 h-[320px] w-[320px] rounded-full bg-accent/10 blur-3xl"
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
            <span>AI 原生爆破工程辅助决策与协同平台</span>
          </div>

          {reduce ? (
            <h1
              id="showcase-hero-title"
              className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              爆擎 BlastForge
            </h1>
          ) : (
            <motion.h1
              id="showcase-hero-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
              className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              爆擎 BlastForge
            </motion.h1>
          )}

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
          >
            从经验驱动走向知识、数据与智能协同驱动。
            将爆破工程参数规划、专业知识检索、多 Agent 协同、风险复核和报告生成
            整合为一套可执行、可解释、可追踪的智能工作流。
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg">
              <Link href="/dashboard" className="inline-flex items-center gap-2">
                <span>进入智能驾驶舱</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/planner" className="inline-flex items-center gap-2">
                <span>启动参数规划</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Badge tone="primary" className="text-[11px]">
              deepseek-v4-pro
            </Badge>
            <Badge tone="outline" className="text-[11px]">
              Phase 2 · 模拟商业会议
            </Badge>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HERO_METRICS.map((metric) => (
              <div
                key={metric.label}
                className="flex min-h-[78px] flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {metric.label}
                </span>
                <span className="tabular mt-auto text-xl font-semibold leading-tight text-foreground">
                  <CountUp
                    value={metric.value}
                    digits={0}
                    suffix={metric.suffix}
                    triggerOnView={false}
                    durationMs={900}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="flex flex-col gap-3"
        >
          <ShowcaseAgentNetwork
            topology={SHOWCASE_TOPOLOGY}
            title="9 节点 Agent 协作网络"
            description="参数条件 → Supervisor 编排 → 规划/检索 → 安全复核 → 报告"
            variant="showcase"
          />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="核心能力">
            {PILLARS.map((pillar) => (
              <li
                key={pillar.title}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface/70 px-3 py-2"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <pillar.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {pillar.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pillar.description}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
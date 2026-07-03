"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function ShowcaseCta({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <section
      aria-labelledby="showcase-cta-title"
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-border bg-surface px-6 py-12 lg:px-12 lg:py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/2 -z-10 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-[-40%] -z-10 h-[260px] w-[260px] rounded-full bg-accent/10 blur-3xl"
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex flex-col items-start gap-4"
      >
        <Badge tone="primary" className="text-[11px]">
          <Sparkles className="h-3 w-3" aria-hidden />
          Phase 2 · 模拟商业会议预演
        </Badge>
        <h2
          id="showcase-cta-title"
          className="max-w-2xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl"
        >
          准备好把爆破工程交给一个可解释的工作流了吗？
        </h2>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          立刻进入驾驶舱查看当前 Demo 工程，或从参数规划开始一次完整 Run：
          工程条件 → Agent 协作 → 方案对比 → 报告归档。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              <span>进入智能驾驶舱</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/planner" className="inline-flex items-center gap-2">
              <span>启动参数规划</span>
            </Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
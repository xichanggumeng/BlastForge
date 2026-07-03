"use client";

import { motion, useReducedMotion } from "motion/react";
import { Lock, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Safety Reviewer 自动复核",
    description:
      "每个 Run 末尾由 Safety Reviewer Agent 强制检查约束冲突与缺失参数；不通过即阻断。",
    badge: "Agent",
  },
  {
    icon: UserCheck,
    title: "Human-in-the-loop",
    description:
      "高风险步骤进入人工确认环节；只有经过人工确认后方案才能进入报告生成。",
    badge: "人工",
  },
  {
    icon: ShieldAlert,
    title: "高风险显式标识",
    description:
      "所有展示的预测值与方案均明确标注「模拟 / 辅助建议」，不允许伪装为施工指令。",
    badge: "标识",
  },
  {
    icon: Lock,
    title: "API Key 与执行边界",
    description:
      "DeepSeek Key 仅存服务端，Tool 白名单化，禁止调用任意 SQL / Shell / 现场控制。",
    badge: "边界",
  },
] as const;

export function ShowcaseSafety({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="showcase-safety-title"
      className={cn("flex flex-col gap-5", className)}
    >
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          安全与人工复核
        </span>
        <h2
          id="showcase-safety-title"
          className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
        >
          AI 给建议，决策留给专业人员
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          BlastForge 是一套工程辅助系统，不替代具备资质的专业工程师。
          所有高风险参数都需要人工确认，所有 Tool 调用都受白名单约束。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PILLARS.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <motion.div
              key={pillar.title}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: idx * 0.06 }}
            >
              <Card tone="elevated" padding="lg" className="h-full gap-3">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-success/40 bg-success/10 text-success"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <Badge tone="success">{pillar.badge}</Badge>
                  </div>
                  <CardTitle>{pillar.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {pillar.description}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
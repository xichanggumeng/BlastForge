"use client";

import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  ShieldCheck,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface Capability {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone: "primary" | "accent" | "success" | "warning";
  bullets: readonly string[];
}

const CAPABILITIES: readonly Capability[] = [
  {
    icon: ClipboardList,
    title: "参数预测与方案规划",
    description:
      "根据工程类型、岩体、含水、环境约束和成本倾向生成参数建议与多套方案。",
    tone: "primary",
    bullets: [
      "推荐 / 备选 / 风险方案",
      "参数敏感性",
      "多维评分",
    ],
  },
  {
    icon: Cpu,
    title: "多 Agent 协同",
    description:
      "Supervisor 协调 8 个专业 Agent，每个 Agent 都有 Schema、工具白名单与版本。",
    tone: "accent",
    bullets: ["Tool Calling", "Input / Output Schema", "可重放 Trace"],
  },
  {
    icon: WorkflowIcon,
    title: "Agentic Workflow",
    description:
      "10 步主 Workflow 覆盖标准化 → 检索 → 规则预检 → 规划 → 评分 → 安全复核。",
    tone: "primary",
    bullets: ["流式事件", "可暂停 / 可恢复", "可重放 Run"],
  },
  {
    icon: BookOpen,
    title: "RAG 知识引用",
    description:
      "关键结论关联具体文档来源与命中片段，避免模型凭空生成。",
    tone: "accent",
    bullets: ["关键词 + 向量 + 元数据", "引用计数", "影响分析"],
  },
  {
    icon: ShieldCheck,
    title: "人工复核",
    description:
      "Safety Reviewer 在高风险或边界条件下请求人工确认，保留责任边界。",
    tone: "warning",
    bullets: ["重点确认清单", "审批记录", "回退到录入"],
  },
  {
    icon: FileText,
    title: "报告生成",
    description:
      "Report Agent 汇总最终方案、知识引用与人工意见，输出可追溯报告。",
    tone: "success",
    bullets: ["Markdown / PDF 预览", "归档快照", "责任边界说明"],
  },
];

const TONE_CLASS: Record<Capability["tone"], string> = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  accent: "border-accent/40 bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

export function ShowcaseCapabilities({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="showcase-cap-title"
      className={cn("flex flex-col gap-5", className)}
    >
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          核心能力模块
        </span>
          <h2
            id="showcase-cap-title"
            className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
          >
            围绕「规划、协同、复核、报告」构建六大能力模块
          </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          每个模块都对应一个 Agent 与一组 Tool，且都遵循相同的设计约束：
          Zod 校验、确定性计算、可解释输出、责任边界清晰。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((cap, idx) => {
          const Icon = cap.icon;
          return (
            <motion.div
              key={cap.title}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: idx * 0.04, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <Card tone="elevated" padding="lg" className="h-full gap-3">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-md border",
                        TONE_CLASS[cap.tone],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <Badge tone="outline">Phase {idx + 2}</Badge>
                  </div>
                  <CardTitle>{cap.title}</CardTitle>
                  <CardDescription>{cap.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    {cap.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <CheckCircle2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                          aria-hidden
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
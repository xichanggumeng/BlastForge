"use client";

import { motion, useReducedMotion } from "motion/react";
import { Box, Cpu, Database, FileText, GitBranch, Layers, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface ArchitectureLayer {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  bullets: readonly string[];
}

const LAYERS: readonly ArchitectureLayer[] = [
  {
    key: "presentation",
    title: "展示层 · Next.js",
    icon: Layers,
    description: "展示首页、智能驾驶舱、规划台、Workflow 与报告预览。",
    bullets: ["Server Components 优先", "Tailwind + 设计 Token", "图表按需加载"],
  },
  {
    key: "application",
    title: "应用层 · Use Cases",
    icon: GitBranch,
    description: "Scenario / Prediction / Workflow / Review / Report 等业务用例。",
    bullets: ["Server Actions", "Zod 校验", "可替换签名"],
  },
  {
    key: "agent",
    title: "Agent Runtime",
    icon: Cpu,
    description: "Orchestrator / Agents / Tools / Memory / Trace Recorder。",
    bullets: ["Agent Registry", "Tool 白名单", "可重放 Trace"],
  },
  {
    key: "infra",
    title: "基础设施适配层",
    icon: Server,
    description: "DeepSeek Provider Adapter、PostgreSQL + pgvector、文件存储。",
    bullets: ["API Key 仅服务端", "结构化日志", "故障降级"],
  },
  {
    key: "data",
    title: "数据层",
    icon: Database,
    description: "项目 / 场景 / Run / Scheme / Knowledge / Review / Report 实体。",
    bullets: ["Drizzle ORM", "JSONB 快照", "审计日志"],
  },
  {
    key: "output",
    title: "输出层 · 报告与回放",
    icon: FileText,
    description: "结构化报告、Markdown / PDF 导出、预录制 Run 回放。",
    bullets: ["明确标识", "不可执行指令", "责任边界"],
  },
];

export function ShowcaseArchitecture({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="showcase-arch-title"
      className={cn("flex flex-col gap-5", className)}
    >
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          产品架构 · 能力矩阵
        </span>
        <h2
          id="showcase-arch-title"
          className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
        >
          从输入到归档：六层闭环
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          BlastForge 的能力矩阵自上而下分为六层，每一层都对应明确的职责、依赖与可替换边界。
        </p>
      </header>

      <ol
        className="flex flex-col gap-3"
        role="list"
        aria-label="产品架构分层"
      >
        {LAYERS.map((layer, idx) => {
          const Icon = layer.icon;
          return (
            <motion.li
              key={layer.key}
              initial={reduce ? false : { opacity: 0, x: -16 }}
              whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: idx * 0.04 }}
              className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface px-4 py-3 lg:grid-cols-[200px_1fr_auto] lg:items-center"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Layer {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {layer.title}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{layer.description}</p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {layer.bullets.map((bullet) => (
                  <Badge key={bullet} tone="outline">
                    {bullet}
                  </Badge>
                ))}
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Box className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span>
          架构分层与规范 §3 / §6 对齐；Phase 3 引入 Provider Adapter 后将平滑切换为独立 Agent Service。
        </span>
      </div>
    </section>
  );
}
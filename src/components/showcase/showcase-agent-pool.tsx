"use client";

import { motion, useReducedMotion } from "motion/react";
import { Cpu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface AgentPreview {
  id: string;
  name: string;
  role: string;
  description: string;
  mode: "thinking" | "non-thinking";
  tools: readonly string[];
}

const AGENTS: readonly AgentPreview[] = [
  {
    id: "supervisor",
    name: "Supervisor",
    role: "任务编排",
    description: "理解用户目标、选择 Workflow、分配 Agent 与控制步骤。",
    mode: "thinking",
    tools: ["select_workflow", "delegate_task"],
  },
  {
    id: "normalizer",
    name: "Input Normalizer",
    role: "参数标准化",
    description: "解析自然语言与表单输入，输出标准参数对象。",
    mode: "non-thinking",
    tools: ["normalize_engineering_parameters"],
  },
  {
    id: "retriever",
    name: "Knowledge Retriever",
    role: "知识检索",
    description: "构造检索查询、返回知识片段与引用。",
    mode: "non-thinking",
    tools: ["search_knowledge"],
  },
  {
    id: "planner",
    name: "Parameter Planner",
    role: "参数规划",
    description: "基于标准化输入与知识依据进行参数预测与规划。",
    mode: "thinking",
    tools: ["plan_parameters", "analyze_parameter_sensitivity"],
  },
  {
    id: "generator",
    name: "Scheme Generator",
    role: "方案生成",
    description: "基于规划结果生成推荐、备选与风险方案。",
    mode: "thinking",
    tools: ["generate_schemes", "compare_schemes"],
  },
  {
    id: "safety",
    name: "Safety Reviewer",
    role: "安全复核",
    description: "检查约束冲突、标记高风险并阻断。",
    mode: "thinking",
    tools: ["run_rule_check", "request_human_approval"],
  },
];

export function ShowcaseAgentPool({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="showcase-agents-title"
      className={cn("flex flex-col gap-5", className)}
    >
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Agent 池预览
        </span>
        <h2
          id="showcase-agents-title"
          className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
        >
          6 个核心 Agent 在 Phase 2 预览中亮相
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          完整 Agent 池共 8 个 Agent（含 Evaluator / Report），全部由 deepseek-v4-pro 驱动，
          通过 Provider Adapter 调用，全部 Tool 白名单化。
        </p>
      </header>

      <ul
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
      >
        {AGENTS.map((agent, idx) => (
          <motion.li
            key={agent.id}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: idx * 0.04 }}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary"
                >
                  <Cpu className="h-4 w-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {agent.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{agent.role}</span>
                </div>
              </div>
              <Badge tone={agent.mode === "thinking" ? "primary" : "accent"}>
                {agent.mode}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-foreground"
                >
                  {tool}
                </span>
              ))}
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
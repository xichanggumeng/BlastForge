import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import type { DashboardKnowledgeCitation } from "@/types/dashboard";
import { cn } from "@/lib/cn";

interface DashboardKnowledgeStripProps {
  citations: readonly DashboardKnowledgeCitation[];
}

export function DashboardKnowledgeStrip({ citations }: DashboardKnowledgeStripProps) {
  return (
    <RevealOnScroll className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          本周知识引用
        </span>
        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {citations.length} 份脱敏知识片段命中
        </h2>
        <p className="text-sm text-muted-foreground">
          Agent 在 Phase 4 通过 RAG 检索以下文档；本面板展示引用计数与归属 Agent。
        </p>
      </header>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        role="list"
      >
        {citations.map((cite, idx) => (
          <article
            key={cite.id}
            role="listitem"
            className={cn(
              "flex h-full flex-col gap-2 rounded-md border border-border bg-surface p-3 transition-colors",
              "hover:border-primary/40 hover:bg-surface-elevated",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
              </span>
              <Badge tone="outline">{cite.category}</Badge>
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
              {cite.title}
            </h3>
            <div className="mt-auto flex flex-col gap-0.5 text-[11px] text-muted-foreground">
              <span className="tabular">{cite.reference}</span>
              <span>引用 Agent · {cite.agent}</span>
            </div>
            <span className="sr-only">第 {idx + 1} 份文档</span>
          </article>
        ))}
      </div>
    </RevealOnScroll>
  );
}
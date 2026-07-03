"use client";

/**
 * 知识引用面板：可在 Planner / Workflow / Reports 中复用。
 *
 * - 列出 Citation（文档 / 章节 / 页码 / 命中片段 / 检索得分 / 影响结论 / 使用的 Agent）；
 * - 点击可展开详情（用于 Dialog 或 Drawer 调用方使用）；
 * - 不允许仅展示 "来自知识库" 等空文本。
 */

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Lightbulb,
  Quote,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import type { KnowledgeCitation } from "@/modules/knowledge/domain";

interface CitationPanelProps {
  citations: ReadonlyArray<KnowledgeCitation>;
  /** 标题 */
  title?: string;
  /** 是否要"无可视引用"提示 */
  emptyHint?: string;
  /** 自定义 className */
  className?: string;
  /** 是否默认展开第一个 */
  defaultOpenFirst?: boolean;
}

const SOURCE_TYPE_LABEL: Record<KnowledgeCitation["sourceType"], string> = {
  knowledge: "教学摘要",
  regulation: "规范摘要",
  case: "教学案例",
  material: "材料",
};

const CATEGORY_LABEL: Record<KnowledgeCitation["category"], string> = {
  explosive: "炸药类型",
  water: "含水场景",
  environment: "环境敏感",
  cost: "成本与便利",
  "risk-review": "风险复核",
  general: "通用教学",
};

export function CitationPanel({
  citations,
  title = "知识引用",
  emptyHint = "本次结果暂无知识引用；表示推理完全由规则与模型推断支撑，建议人工补充关联文档。",
  className,
  defaultOpenFirst = true,
}: CitationPanelProps) {
  const [openId, setOpenId] = useState<string | null>(
    defaultOpenFirst && citations.length > 0 ? (citations[0]?.id ?? null) : null,
  );

  if (citations.length === 0) {
    return (
      <Card tone="muted" padding="md" className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card tone="default" padding="md" className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge tone="outline" size="sm">
            {citations.length} 条引用
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          引用源均为真实存在的知识片段；不得改写或编造。
        </p>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {citations.map((c) => (
            <CitationItem
              key={c.id}
              citation={c}
              open={openId === c.id}
              onToggle={() => setOpenId((prev) => (prev === c.id ? null : c.id))}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

interface CitationItemProps {
  citation: KnowledgeCitation;
  open: boolean;
  onToggle: () => void;
}

function CitationItem({ citation, open, onToggle }: CitationItemProps) {
  const loc = formatLocation(citation);

  return (
    <li className="overflow-hidden rounded-md border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {citation.documentTitle}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {SOURCE_TYPE_LABEL[citation.sourceType]} · {CATEGORY_LABEL[citation.category]}
            {loc ? ` · ${loc}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={citation.score} />
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/30 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary" size="sm">
              <FileText className="mr-1 h-3 w-3" aria-hidden /> 来源：{citation.documentId}
            </Badge>
            {citation.matchedTokens.length > 0 ? (
              <Badge tone="accent" size="sm">
                命中关键词：{citation.matchedTokens.slice(0, 6).join("、")}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface p-2">
            <Quote className="mt-0.5 h-3.5 w-3.5 text-primary" aria-hidden />
            <p className="flex-1 leading-relaxed text-foreground">{citation.excerpt}</p>
          </div>
          {citation.affectedConclusions.length > 0 ? (
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 text-warning" aria-hidden />
              <div className="flex flex-1 flex-wrap gap-1">
                <span className="text-muted-foreground">影响结论：</span>
                {citation.affectedConclusions.map((c) => (
                  <Badge key={c} tone="warning" size="sm">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {citation.usedByAgents.length > 0 ? (
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-3.5 w-3.5 text-accent" aria-hidden />
              <div className="flex flex-1 flex-wrap gap-1">
                <span className="text-muted-foreground">被 Agent 使用：</span>
                {citation.usedByAgents.map((a) => (
                  <Badge key={a} tone="outline" size="sm">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {citation.matchedTokens.length > 0 ? (
            <div className="rounded-md border border-border bg-surface p-2">
              <span className="text-muted-foreground">高亮片段：</span>
              <HighlightedExcerpt
                excerpt={citation.excerpt}
                tokens={citation.matchedTokens}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone = pct >= 70 ? "success" : pct >= 40 ? "warning" : "outline";
  return (
    <Badge tone={tone} size="sm" aria-label={`检索得分 ${pct}%`}>
      {pct}%
    </Badge>
  );
}

function HighlightedExcerpt({
  excerpt,
  tokens,
}: {
  excerpt: string;
  tokens: ReadonlyArray<string>;
}) {
  if (tokens.length === 0) return null;
  const lower = excerpt.toLowerCase();
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let i = 0;
  while (i < excerpt.length) {
    let matched = false;
    for (const t of tokens) {
      if (!t) continue;
      const seg = excerpt.slice(i, i + t.length).toLowerCase();
      if (seg === t.toLowerCase()) {
        parts.push({ text: excerpt.slice(i, i + t.length), highlight: true });
        i += t.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const last = parts[parts.length - 1];
      if (last && !last.highlight) last.text += excerpt[i];
      else parts.push({ text: excerpt[i] ?? "", highlight: false });
      i += 1;
    }
    void lower;
  }
  return (
    <p className="mt-1 flex flex-wrap gap-0.5">
      {parts.map((p, idx) => (
        <span
          key={idx}
          className={cn(
            p.highlight ? "rounded bg-primary/15 px-1 text-foreground" : "text-muted-foreground",
          )}
        >
          {p.text}
        </span>
      ))}
    </p>
  );
}

function formatLocation(citation: KnowledgeCitation): string {
  if (citation.page && citation.section) {
    return `第 ${citation.page} 页 · ${citation.section}`;
  }
  if (citation.section) return citation.section;
  if (citation.page) return `第 ${citation.page} 页`;
  return "";
}

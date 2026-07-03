"use client";

/**
 * ApprovalBoard —— 单个 Run 的待确认列表与审批操作。
 *
 * 每个 item 支持：
 *  - accept：直接通过
 *  - modify-accept：填入修改字段后通过
 *  - reject：驳回（保留 pending；与 return 等价）
 *  - return：返回 Planner（保留 pending）
 *  - comment：复核意见（必填）
 *
 * Agent 不得自动通过；UI 强制 reviewer 显式提交。
 */

import { useCallback, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, RotateCcw, ShieldAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

import type {
  ApprovalTransitionResult,
  AwaitingApprovalSnapshot,
} from "@/modules/human-review/domain";

type Action = "accept" | "modify-accept" | "reject" | "return";

interface ApprovalBoardProps {
  snapshot: AwaitingApprovalSnapshot;
}

const SEVERITY_TONE = {
  info: "outline",
  warning: "warning",
  block: "danger",
} as const;

const ACTION_LABEL: Record<Action, string> = {
  accept: "通过",
  "modify-accept": "修改后通过",
  reject: "驳回",
  return: "返回 Planner",
};

export function ApprovalBoard({ snapshot }: ApprovalBoardProps) {
  const [items, setItems] = useState(snapshot.pendingItems);
  const [history, setHistory] = useState(snapshot.history);
  const [expandedId, setExpandedId] = useState<string | null>(snapshot.pendingItems[0]?.id ?? null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (itemId: string, action: Action) => {
      setBusyId(itemId);
      setError(null);
      const root = document.getElementById(`approval-form-${itemId}`);
      const commentEl = root?.querySelector(`textarea[name="comment-${itemId}"]`) as HTMLTextAreaElement | null;
      const comment = commentEl?.value.trim() ?? "";
      if (!comment) {
        setBusyId(null);
        setError("请填写复核意见再提交。");
        return;
      }
      try {
        const res = await fetch("/api/agent/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: snapshot.runId,
            checklistItemId: itemId,
            action,
            comment,
          }),
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: ApprovalTransitionResult;
          error?: { message: string };
        };
        if (!json.success || !json.data) {
          throw new Error(json.error?.message ?? "提交失败");
        }
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setHistory((prev) => [json.data!.record, ...prev]);
        setExpandedId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "提交失败。");
      } finally {
        setBusyId(null);
      }
    },
    [snapshot.runId],
  );

  if (items.length === 0 && history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">当前 Run 没有待确认项；所有检查已通过规则与模型校验。</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <div className="rounded-md border border-success/40 bg-success/5 p-3 text-xs text-success">
          本 Run 的所有待确认项已处理完成；可前往 Workflow 或 Reports 查看结果。
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger/40 bg-danger/5 p-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const open = expandedId === item.id;
          return (
            <li
              key={item.id}
              className={cn(
                "overflow-hidden rounded-md border bg-surface",
                item.severity === "block"
                  ? "border-danger/40"
                  : item.severity === "warning"
                    ? "border-warning/40"
                    : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.ownerRole} · {item.canBypass ? "可覆写" : "禁止自动通过"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={SEVERITY_TONE[item.severity]} size="sm">
                    {item.severity}
                  </Badge>
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </div>
              </button>
              {open ? (
                <div
                  id={`approval-form-${item.id}`}
                  className="flex flex-col gap-2 border-t border-border bg-muted/30 p-3 text-xs"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-muted-foreground">复核意见（必填）</span>
                    <Textarea
                      name={`comment-${item.id}`}
                      rows={3}
                      placeholder="例如：已确认最大单响 80kg、振速 1.0cm/s 监测到位；可推进。"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busyId === item.id}
                      onClick={() => void submit(item.id, "accept")}
                    >
                      {busyId === item.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                      )}
                      {ACTION_LABEL.accept}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id || !item.canBypass}
                      onClick={() => void submit(item.id, "modify-accept")}
                      title={!item.canBypass ? "高风险条目禁止修改后通过" : undefined}
                    >
                      {ACTION_LABEL["modify-accept"]}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === item.id}
                      onClick={() => void submit(item.id, "reject")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" aria-hidden />
                      {ACTION_LABEL.reject}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === item.id}
                      onClick={() => void submit(item.id, "return")}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
                      {ACTION_LABEL.return}
                    </Button>
                    {!item.canBypass ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-danger">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> 高风险 · 必须人工签收
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {history.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <span className="font-semibold text-foreground">历史审批（{history.length}）</span>
          <ul className="flex flex-col gap-1">
            {history.slice(0, 8).map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
              >
                <span className="text-muted-foreground">
                  {h.createdAt.slice(0, 19).replace("T", " ")} · {h.reviewer.name} ({h.reviewer.role})
                </span>
                <Badge
                  tone={
                    h.status === "accepted"
                      ? "success"
                      : h.status === "accepted-with-modifications"
                        ? "primary"
                        : h.status === "rejected"
                          ? "danger"
                          : "warning"
                  }
                  size="sm"
                >
                  {h.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
"use client";

/**
 * GenerateReportButton —— 客户端触发报告生成。
 *
 * 通过 POST /api/reports 把当前 agentRunId 提交给服务端；
 * 服务端从 RunRepository / HumanApprovalService 收集数据，构造 Report。
 */

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface GenerateReportButtonProps {
  runId: string | null;
  replay?: boolean;
  className?: string;
}

export function GenerateReportButton({
  runId,
  replay,
  className,
}: GenerateReportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const submit = async () => {
    if (!runId) {
      setError("当前 Run 尚未生成报告所需数据。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, replay }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { id: string };
        error?: { message: string };
      };
      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? "生成失败");
      }
      setReportId(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        size="sm"
        variant="primary"
        disabled={busy || !runId}
        onClick={() => void submit()}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden />
        )}
        生成报告
      </Button>
      {error ? (
        <span className="text-[11px] text-danger">{error}</span>
      ) : null}
      {reportId ? (
        <a
          href={`/reports?focus=${reportId}`}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <Badge tone="success" size="sm">
            已生成
          </Badge>
          前往查看（{reportId.slice(-8)}）
        </a>
      ) : null}
    </div>
  );
}
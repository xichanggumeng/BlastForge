"use client";

/**
 * GenerateReportButton —— 客户端触发报告生成 + 一键下载 PDF。
 *
 * 通过 POST /api/reports 把 PlanningRun + (可选) agentRunId 提交给服务端；
 * 服务端优先按 agentRunId 从 RunRepository 读取；找不到时（例如 Agent 回退到本地
 * Demo Planner，本地 PlanningRun 从未在 RunRepository 留痕）直接使用请求体里
 * 的 planningRun 构造报告。
 *
 * 生成成功后：
 *  - 展示「下载 PDF」/「下载 Markdown」/「下载 JSON」三条链接，全部走 /api/reports?format=...
 *  - PDF 走 fetch + blob download，避免 `<a download>` 拿到 JSON 错误页
 */

import { useState } from "react";
import { Download, FileJson, FileText, FileType2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Citation } from "@/modules/agent-runtime/core/contracts";
import type { PlanningRun } from "@/modules/parameter-planning/domain/contracts";

interface GenerateReportButtonProps {
  /** Agent 模式下的 WorkflowRun id；本地 Demo Planner 模式下为 null。 */
  runId: string | null;
  /** 当前活跃的 PlanningRun（必须能 hold 一个完整 run 才能生成报告）。 */
  planningRun: PlanningRun | null;
  /** Agent 模式下累积的 citations；本地模式通常为空。 */
  citations?: ReadonlyArray<Citation>;
  replay?: boolean;
  className?: string;
}

export function GenerateReportButton({
  runId,
  planningRun,
  citations,
  replay,
  className,
}: GenerateReportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const submit = async () => {
    if (!runId && !planningRun) {
      setError("当前 Run 尚未生成报告所需数据。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { replay: replay === true };
      if (runId) payload.runId = runId;
      if (planningRun) payload.planningRun = planningRun;
      if (citations && citations.length > 0) payload.citations = citations;

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const downloadPdf = async (id: string): Promise<void> => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports?id=${encodeURIComponent(id)}&format=pdf`);
      if (!res.ok) {
        const text = await res.text();
        let message = `PDF 下载失败（HTTP ${res.status}）`;
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string } };
          if (parsed.error?.message) message = parsed.error.message;
        } catch {
          // 非 JSON
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        size="sm"
        variant="primary"
        disabled={busy || (!runId && !planningRun)}
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <Badge tone="success" size="sm">
              已生成
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {reportId.slice(-8)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void downloadPdf(reportId)}
              disabled={downloading}
              className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs text-accent hover:bg-accent/15 disabled:opacity-50"
              aria-busy={downloading}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden />
              )}
              下载 PDF
            </button>
            <a
              href={`/api/reports?id=${reportId}&format=md`}
              download={`${reportId}.md`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-muted/40"
            >
              <FileType2 className="h-3.5 w-3.5" aria-hidden />
              Markdown
            </a>
            <a
              href={`/api/reports?id=${reportId}&format=json`}
              download={`${reportId}.json`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-muted/40"
            >
              <FileJson className="h-3.5 w-3.5" aria-hidden />
              JSON
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
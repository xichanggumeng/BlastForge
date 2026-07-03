"use client";

/**
 * ReportList —— 列出所有已生成报告，支持预览 / 打印 / Markdown / JSON / PDF 导出。
 *
 * PDF 下载走 `/api/reports?id=&format=pdf`；
 * 失败时由服务端返回 JSON 错误，浏览器 `<a download>` 仍会尝试下载——为避免误存 JSON，
 * 这里点击时通过 fetch 探活，再走 attachment 下载。
 */

import { useState } from "react";
import {
  Download,
  Eye,
  FileJson,
  FileText,
  FileType2,
  Loader2,
  Printer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { Report } from "@/modules/report/domain";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE = {
  draft: "neutral",
  "pending-review": "warning",
  approved: "success",
  archived: "outline",
} as const;

const STATUS_LABEL = {
  draft: "草稿",
  "pending-review": "待复核",
  approved: "已批准",
  archived: "已归档",
} as const;

export function ReportList({ reports }: { reports: ReadonlyArray<Report> }) {
  const [previewing, setPreviewing] = useState<Report | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadPdf = async (report: Report): Promise<void> => {
    setDownloading(report.id);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/reports?id=${encodeURIComponent(report.id)}&format=pdf`);
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
      a.download = `${report.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "PDF 下载失败");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id} tone="elevated" padding="lg">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">{report.scenarioName}</CardTitle>
                  <CardDescription>
                    Run {report.runId.slice(-8)} · {formatDateTime(report.createdAt)}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone={STATUS_TONE[report.status]} size="sm">
                    {STATUS_LABEL[report.status]}
                  </Badge>
                  {report.replay ? (
                    <Badge tone="warning" size="sm">
                      回放模式
                    </Badge>
                  ) : (
                    <Badge tone="primary" size="sm">
                      真实调用
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                引用 {report.citations.length} 条 · 章节 {report.sections.length} 个 ·
                责任人 {report.generatedBy}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setPreviewing(report)}
                >
                  <Eye className="h-3.5 w-3.5" /> 预览
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void downloadPdf(report)}
                  disabled={downloading === report.id}
                  aria-busy={downloading === report.id}
                >
                  {downloading === report.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  )}
                  下载 PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPrint(report.id)}
                >
                  <Printer className="h-3.5 w-3.5" /> 打印 / HTML
                </Button>
                <a
                  href={`/api/reports?id=${report.id}&format=md`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-muted/40"
                  download={`${report.id}.md`}
                >
                  <FileType2 className="h-3.5 w-3.5" /> Markdown
                </a>
                <a
                  href={`/api/reports?id=${report.id}&format=json`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-muted/40"
                  download={`${report.id}.json`}
                >
                  <FileJson className="h-3.5 w-3.5" /> JSON
                </a>
                <a
                  href={`/api/reports?id=${report.id}&format=html`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-muted/40"
                >
                  <FileText className="h-3.5 w-3.5" /> HTML（新窗口）
                </a>
              </div>
              {downloadError && downloading === null ? (
                <p className="mt-2 text-[11px] text-danger">{downloadError}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {previewing ? (
        <ReportPreviewOverlay
          report={previewing}
          downloading={downloading === previewing.id}
          onClose={() => setPreviewing(null)}
          onDownload={() => void downloadPdf(previewing)}
        />
      ) : null}
    </>
  );
}

function openPrint(reportId: string) {
  // 打开 HTML 视图 → 用户使用浏览器打印保存为 PDF
  const url = `/api/reports?id=${encodeURIComponent(reportId)}&format=html`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function ReportPreviewOverlay({
  report,
  onClose,
  onDownload,
  downloading,
}: {
  report: Report;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`预览报告 ${report.id}`}
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{report.scenarioName}</span>
            <span className="text-xs text-muted-foreground">
              Run {report.runId.slice(-8)} · {formatDateTime(report.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={onDownload}
              disabled={downloading}
              aria-busy={downloading}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden />
              )}
              下载 PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => openPrint(report.id)}>
              <Printer className="h-3.5 w-3.5" /> 打印 / HTML
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              关闭
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 text-sm leading-relaxed">
          <article className="prose prose-sm mx-auto max-w-none dark:prose-invert">
            {report.sections.map((s) => (
              <section key={s.key} className="mb-6">
                <h2 className="text-base font-semibold">{s.title}</h2>
                <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">
                  {s.body}
                </pre>
              </section>
            ))}
            <section className="mb-6">
              <h2 className="text-base font-semibold">安全与责任边界</h2>
              <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">
                {report.responsibilityBoundary}
              </pre>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
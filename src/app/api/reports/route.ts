/**
 * Route Handler: Report 中心。
 *
 * GET  /api/reports                          —— 列出全部报告；
 * GET  /api/reports?id=...                   —— 单个报告（JSON）；
 * GET  /api/reports?format=md|json|html&id=... —— 导出文件流；
 * POST /api/reports                          —— 创建报告；Body 包含 runId，可选 generatedBy。
 *
 * 数据来源：
 *  - Run 数据来自 RunRepository；
 *  - 引用从 Run 事件中的 citation.attached 自动收集；
 *  - Approval Snapshot 来自 HumanApprovalService（按 runId 查询）。
 */

import { NextResponse } from "next/server";

import { buildReport, exportHTML, exportJSON, exportMarkdown, type Report } from "@/modules/report/domain";
import { getReportRepository } from "@/modules/report/infrastructure/repository";
import { getRunRepository } from "@/modules/agent-runtime/core/run-repository";
import { getHumanApprovalService } from "@/modules/human-review/domain";
import type { Citation } from "@/modules/agent-runtime/core/contracts";
import type { PlanningRun } from "@/modules/parameter-planning/domain/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const id = url.searchParams.get("id");

  if (!id) {
    const reports = getReportRepository().list(20);
    return NextResponse.json({ success: true, data: reports, requestId: null });
  }
  const repo = getReportRepository();
  const report = repo.get(id);
  if (!report) {
    return NextResponse.json(
      { success: false, error: { code: "REPORT_NOT_FOUND", message: `未找到报告：${id}` }, requestId: id },
      { status: 404 },
    );
  }
  if (format === "md" || format === "markdown") {
    const body = exportMarkdown(report);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${report.id}.md"`,
      },
    });
  }
  if (format === "html") {
    const body = exportHTML(report);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `inline; filename="${report.id}.html"`,
      },
    });
  }
  if (format === "json") {
    const body = exportJSON(report);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${report.id}.json"`,
      },
    });
  }
  return NextResponse.json({ success: true, data: report, requestId: id });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const runId = typeof body.runId === "string" ? body.runId : null;
  if (!runId) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "runId 必填。" }, requestId: null },
      { status: 400 },
    );
  }
  const repo = getRunRepository();
  const run = repo.get(runId);
  if (!run) {
    return NextResponse.json(
      { success: false, error: { code: "RUN_NOT_FOUND", message: `未找到 Run：${runId}` }, requestId: runId },
      { status: 404 },
    );
  }
  const events = repo.getEvents(runId);
  const citations = collectCitationsFromEvents(events);
  const approval = getHumanApprovalService().list(runId);
  const planningRun = projectRun(run, citations, approval);

  const report: Report = buildReport({
    run: planningRun,
    citations,
    approval,
    generatedBy: typeof body.generatedBy === "string" ? body.generatedBy : "Demo Reporter",
    replay: run.replay,
  });
  getReportRepository().save(report);
  return NextResponse.json({ success: true, data: report, requestId: report.id });
}

function collectCitationsFromEvents(events: ReadonlyArray<{ type: string; payload: Record<string, unknown>; eventId: string }>): Citation[] {
  const out: Citation[] = [];
  for (const evt of events) {
    if (evt.type === "citation.attached") {
      const id = String(evt.payload["citationId"] ?? evt.eventId);
      out.push({
        id,
        documentId: String(evt.payload["documentId"] ?? evt.payload["documentTitle"] ?? ""),
        documentTitle: String(evt.payload["documentTitle"] ?? ""),
        category: String(evt.payload["category"] ?? "general"),
        excerpt: String(evt.payload["excerpt"] ?? ""),
        score: Number(evt.payload["score"] ?? 0),
      });
    }
  }
  return out;
}

function projectRun(
  run: ReturnType<typeof getRunRepository>["get"] extends (id: string) => infer R ? R : never,
  citations: ReadonlyArray<Citation>,
  approval: ReturnType<typeof getHumanApprovalService>["list"] extends (id: string) => infer R ? R : never,
): PlanningRun {
  // 用 citations / approval 反向构造一个最小可用的 PlanningRun 形状；
  // 真实场景中应把完整 Run 状态作为 PlanningRun 持久化。
  void citations;
  void approval;
  return run as unknown as PlanningRun;
}
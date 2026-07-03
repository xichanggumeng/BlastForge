/**
 * Route Handler: Report 中心。
 *
 * GET  /api/reports                                 —— 列出全部报告；
 * GET  /api/reports?id=...                          —— 单个报告（JSON）；
 * GET  /api/reports?id=...&format=md|json|html|pdf  —— 导出文件流（PDF 由 puppeteer 渲染）；
 * POST /api/reports                                 —— 创建报告；Body 包含 runId，可选 generatedBy / scenarioName。
 *
 * 数据来源：
 *  - 优先把 Run（WorkflowRun）转 PlanningRun：复用 `adaptToPlanningRun()`，避免 `as unknown` 强转；
 *  - Run 数据来自 RunRepository；
 *  - 引用从 Run 事件中的 citation.attached 自动收集；
 *  - Approval Snapshot 来自 HumanApprovalService（按 runId 查询）。
 */

import { NextResponse } from "next/server";

import {
  buildReport,
  exportHTML,
  exportJSON,
  exportMarkdown,
  type Report,
} from "@/modules/report/domain";
import { getReportRepository } from "@/modules/report/infrastructure/repository";
import { renderReportPdf, PdfRenderError } from "@/modules/report/infrastructure/pdf-renderer";
import { getRunRepository } from "@/modules/agent-runtime/core/run-repository";
import {
  adaptToPlanningRun,
  collectCitationsFromEvents,
  type OrchestratorInput,
} from "@/modules/agent-runtime/core/orchestrator";
import { getHumanApprovalService } from "@/modules/human-review/domain";
import { getTraceRecorder } from "@/modules/agent-runtime/core/trace-recorder";
import type { PlanningRun } from "@/modules/parameter-planning/domain/contracts";
import type { Citation, FrontendTraceSummary } from "@/modules/agent-runtime/core/contracts";
import type { AwaitingApprovalSnapshot } from "@/modules/human-review/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// puppeteer + 同步 adaptToPlanningRun 累计可能 > 15s，给到 30s
export const maxDuration = 30;

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

  if (format === "pdf") {
    try {
      const buffer = await renderReportPdf(report);
      // Buffer 在 NextResponse 中需要被显式转成 Uint8Array；edge runtime 下也可能被拒绝，
      // 这里 runtime: 'nodejs'，直接转 arrayBuffer 即可。
      const body = new Uint8Array(buffer);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": String(body.byteLength),
          "content-disposition": `attachment; filename="${report.id}.pdf"`,
          "cache-control": "no-store",
        },
      });
    } catch (err) {
      const message =
        err instanceof PdfRenderError
          ? err.message
          : err instanceof Error
            ? err.message
            : "PDF 渲染失败";
      return NextResponse.json(
        { success: false, error: { code: "PDF_RENDER_FAILED", message }, requestId: report.id },
        { status: 502 },
      );
    }
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
  const planningRunPayload: unknown =
    body.planningRun && typeof body.planningRun === "object" ? body.planningRun : null;
  const citationsPayload: ReadonlyArray<Citation> = Array.isArray(body.citations)
    ? (body.citations.filter((c) => c && typeof c === "object") as ReadonlyArray<Citation>)
    : [];
  const replayFlag = body.replay === true;

  if (!runId && !planningRunPayload) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "runId 必填，或随请求附上 planningRun。" }, requestId: null },
      { status: 400 },
    );
  }

  // 路径 A：服务器端 WorkflowRun（Agent 真跑过的 Run）
  const run = runId ? getRunRepository().get(runId) : undefined;

  let planningRun: PlanningRun;
  let citations: ReadonlyArray<Citation>;
  let approval: AwaitingApprovalSnapshot | null;
  let replay: boolean;

  if (run && runId) {
    const input = getRunRepository().getInput(runId);
    if (!input) {
      return NextResponse.json(
        { success: false, error: { code: "INPUT_MISSING", message: "该 Run 未保存原始输入，无法生成报告。" }, requestId: runId },
        { status: 422 },
      );
    }

    const events = getRunRepository().getEvents(runId);
    const eventCitations = collectCitationsFromEvents(events);
    approval = getHumanApprovalService().list(runId);

    const traces: FrontendTraceSummary[] = getTraceRecorder()
      .listByRun(runId)
      .map((t) => ({
        id: t.id,
        runId: t.runId,
        stepId: t.stepId,
        model: t.model,
        mode: t.mode,
        promptVersion: t.promptVersion,
        startedAt: t.startedAt,
        ...(t.agentId ? { agentId: t.agentId } : {}),
        ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
        ...(t.completedAt !== undefined ? { completedAt: t.completedAt } : {}),
        ...(t.durationMs !== undefined ? { durationMs: t.durationMs } : {}),
        ...(t.errorCode ? { errorCode: t.errorCode } : {}),
        status: t.status,
      }));

    const adapterInput: OrchestratorInput = {
      runId,
      workflowId: run.workflowId,
      ...(run.scenarioId ? { scenarioId: run.scenarioId } : {}),
      ...(run.presetId ? { presetId: run.presetId } : {}),
      input,
      requestId: "report",
      forceReplay: run.replay,
    };
    const adapter = adaptToPlanningRun(
      { run, events, traces, replay: run.replay },
      adapterInput,
    );
    planningRun = adapter.planningRun;
    citations = mergeCitations(eventCitations, adapter.citations);
    replay = run.replay;
  } else {
    // 路径 B：客户端 PlanningRun（本地 Demo Planner / Agent 回退路径）
    // 这些场景从未在 RunRepository 留痕，需要由客户端把 PlanningRun 直接带上。
    if (!planningRunPayload) {
      const fakeId = runId ?? "<unknown>";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RUN_NOT_FOUND",
            message: `未找到 Run：${fakeId}；请在请求体附加 planningRun 以生成报告。`,
          },
          requestId: fakeId,
        },
        { status: 404 },
      );
    }
    planningRun = planningRunPayload as PlanningRun;
    citations = citationsPayload;
    approval = null;
    replay = replayFlag;
  }

  const report: Report = buildReport({
    run: planningRun,
    citations,
    approval,
    generatedBy: typeof body.generatedBy === "string" ? body.generatedBy : "Demo Reporter",
    replay,
  });
  getReportRepository().save(report);
  return NextResponse.json({ success: true, data: report, requestId: report.id });
}

function mergeCitations(
  a: ReadonlyArray<Citation>,
  b: ReadonlyArray<Citation>,
): ReadonlyArray<Citation> {
  const map = new Map<string, Citation>();
  for (const c of a) map.set(c.id, c);
  for (const c of b) {
    const exist = map.get(c.id);
    if (exist) {
      map.set(c.id, {
        ...exist,
        ...c,
        matchedTokens: dedupStrings([...(exist.matchedTokens ?? []), ...(c.matchedTokens ?? [])]),
        usedByAgents: dedupStrings([...(exist.usedByAgents ?? []), ...(c.usedByAgents ?? [])]),
        affectedConclusions: dedupStrings([
          ...(exist.affectedConclusions ?? []),
          ...(c.affectedConclusions ?? []),
        ]),
      });
    } else {
      map.set(c.id, c);
    }
  }
  return Array.from(map.values());
}

function dedupStrings(arr: ReadonlyArray<string>): ReadonlyArray<string> {
  return Array.from(new Set(arr));
}

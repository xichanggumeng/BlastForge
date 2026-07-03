/**
 * Route Handler: 查询已完成 Workflow Run 的最终状态（用于流中断后恢复）。
 *
 * GET /api/agent/runs/[id]
 *
 * 返回：
 * - 完整 WorkflowRun（前端安全字段，不含隐藏思维 / API Key）
 * - 全部 WorkflowEvent
 * - Frontend Trace Summary
 * - 是否处于 Replay 模式
 */

import { NextResponse } from "next/server";

import { getRunRepository } from "@/modules/agent-runtime/core/run-repository";
import { listTraceSummariesForRun } from "@/modules/agent-runtime/core/trace-recorder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const repo = getRunRepository();
  const run = repo.get(id);
  if (!run) {
    return NextResponse.json(
      { success: false, error: { code: "RUN_NOT_FOUND", message: `未找到 Run：${id}` }, requestId: null },
      { status: 404 },
    );
  }
  const events = repo.getEvents(id);
  const traces = listTraceSummariesForRun(id);
  return NextResponse.json({
    success: true,
    data: {
      run,
      events,
      traces,
      replay: run.replay,
    },
    requestId: id,
  });
}

/** DELETE /api/agent/runs/[id] —— 取消正在运行的 Run。 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const repo = getRunRepository();
  const ok = repo.cancel(id);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: { code: "RUN_NOT_FOUND", message: `未找到 Run：${id}` }, requestId: id },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: { id, cancelled: true }, requestId: id });
}
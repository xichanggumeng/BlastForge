/**
 * Route Handler: 把 WorkflowRun 转换为 PlanningRun，便于 Planner Workbench 使用。
 *
 * POST /api/agent/runs/[id]/convert
 *
 * 把服务端持久化的 Run + 事件 + 输入组合后，调用 planDemo 重新计算 PlanningRun；
 * blockedReason / status 会从 WorkflowRun 透传。
 */

import { NextResponse } from "next/server";

import {
  adaptToPlanningRun,
  collectCitationsFromEvents,
} from "@/modules/agent-runtime/core/orchestrator";
import { getRunRepository } from "@/modules/agent-runtime/core/run-repository";
import { getTraceRecorder } from "@/modules/agent-runtime/core/trace-recorder";
import type { Citation, WorkflowEvent, WorkflowRun } from "@/modules/agent-runtime/core/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const repo = getRunRepository();
  const run = repo.get(id);
  const input = repo.getInput(id);
  const events: readonly WorkflowEvent[] = repo.getEvents(id);

  if (!run) {
    return NextResponse.json(
      { success: false, error: { code: "RUN_NOT_FOUND", message: `Run ${id} 不存在` } },
      { status: 404 },
    );
  }
  if (!input) {
    return NextResponse.json(
      { success: false, error: { code: "INPUT_MISSING", message: "该 Run 未保存原始输入" } },
      { status: 422 },
    );
  }

  const traces = getTraceRecorder()
    .listByRun(id)
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

  const citations: Citation[] = collectCitationsFromEvents(events);

  const adapter = adaptToPlanningRun(
    { run: run as WorkflowRun, events, traces: traces as never, replay: run.replay },
    {
      runId: id,
      workflowId: run.workflowId,
      input,
      requestId: "replay",
      forceReplay: run.replay,
    },
  );

  return NextResponse.json({
    success: true,
    data: {
      planningRun: adapter.planningRun,
      citations,
      traces,
      run,
      events,
    },
  });
}
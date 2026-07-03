/**
 * Route Handler: 列出最近的 Workflow Runs（用于 Workflow 视图 + Agent 工作台）。
 *
 * GET /api/agent/runs
 */

import { NextResponse } from "next/server";

import { getRunRepository } from "@/modules/agent-runtime/core/run-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "12");
  const repo = getRunRepository();
  const runs = repo.listRecentForFrontend(Number.isFinite(limit) ? limit : 12);
  return NextResponse.json({ success: true, data: runs, requestId: null });
}
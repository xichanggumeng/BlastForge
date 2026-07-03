/**
 * Route Handler: 人工审批中心。
 *
 * GET  /api/agent/approvals            —— 列出所有等待确认的 Run 摘要；
 * GET  /api/agent/approvals?runId=...  —— 查询单个 Run 的 Approval Snapshot；
 * POST /api/agent/approvals            —— 执行审批（accept / modify-accept / reject / return）。
 */

import { NextResponse } from "next/server";

import {
  getHumanApprovalService,
  approvalRecordSchema,
  type ApprovalFieldOverride,
  type ReviewerIdentity,
} from "@/modules/human-review/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const service = getHumanApprovalService();
  if (runId) {
    const snap = service.list(runId);
    if (!snap) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "APPROVAL_NOT_FOUND", message: `未找到 Run ${runId} 的审批快照。` },
          requestId: runId,
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: snap, requestId: runId });
  }
  return NextResponse.json({
    success: true,
    data: service.listAll(),
    requestId: null,
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Body 必须是合法 JSON。" }, requestId: null },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Body 必须是对象。" }, requestId: null },
      { status: 400 },
    );
  }
  const { runId, checklistItemId, action, reviewer, comment, overrides } = body as Record<string, unknown>;
  if (typeof runId !== "string" || typeof checklistItemId !== "string" || typeof action !== "string") {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "runId / checklistItemId / action 必填。" },
        requestId: null,
      },
      { status: 400 },
    );
  }
  if (!["accept", "modify-accept", "reject", "return"].includes(action)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "action 必须是 accept / modify-accept / reject / return 之一。" },
        requestId: null,
      },
      { status: 400 },
    );
  }
  try {
    const result = getHumanApprovalService().transition({
      runId,
      checklistItemId,
      action: action as "accept" | "modify-accept" | "reject" | "return",
      reviewer: isReviewerIdentity(reviewer) ? reviewer : undefined,
      comment: typeof comment === "string" ? comment : undefined,
      overrides: Array.isArray(overrides)
        ? (overrides.filter(isApprovalOverride) as ApprovalFieldOverride[])
        : undefined,
    });
    return NextResponse.json({ success: true, data: result, requestId: runId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "审批失败。";
    return NextResponse.json(
      { success: false, error: { code: "APPROVAL_FAILED", message }, requestId: runId },
      { status: 400 },
    );
  }
}

function isReviewerIdentity(value: unknown): value is ReviewerIdentity {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).id === "string" &&
    typeof (value as Record<string, unknown>).name === "string" &&
    typeof (value as Record<string, unknown>).role === "string"
  );
}

function isApprovalOverride(value: unknown): value is ApprovalFieldOverride {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).field === "string"
  );
}

// Re-export for test-friendly imports
export { approvalRecordSchema };
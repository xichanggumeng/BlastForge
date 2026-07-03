/**
 * Human-in-the-Loop —— 人工确认（Demo Reviewer）模块。
 *
 * 数据结构：
 *  - ApprovalRecord：每一次人工确认记录；
 *  - ApprovalStatus：等待中 / 已通过 / 已修改后通过 / 已驳回 / 已返回。
 *
 * 设计目标：
 *  - 无真实身份认证时默认使用 Demo Reviewer 身份，但字段可扩展；
 *  - Workflow 必须在 awaiting_review 状态下显式接收 ApprovalRecord 后才能继续。
 */

import { z } from "zod";

export const APPROVER_ROLES = ["reviewer", "planner", "engineer", "safety-officer"] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];

export const approvalStatusSchema = z.enum([
  "waiting_for_approval",
  "accepted",
  "accepted-with-modifications",
  "rejected",
  "returned",
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const reviewerIdentitySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(APPROVER_ROLES),
  /** Demo 模式下标记为 Demo Reviewer；真实环境下可改为 false */
  demo: z.boolean().default(true),
});
export type ReviewerIdentity = z.infer<typeof reviewerIdentitySchema>;

export const approvalFieldOverrideSchema = z.object({
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  reason: z.string().optional(),
});
export type ApprovalFieldOverride = z.infer<typeof approvalFieldOverrideSchema>;

export const approvalRecordSchema = z.object({
  id: z.string(),
  /** 关联 Run id */
  runId: z.string(),
  /** 关联 ChecklistItem id */
  checklistItemId: z.string(),
  status: approvalStatusSchema,
  reviewer: reviewerIdentitySchema,
  comment: z.string().default(""),
  overrides: z.array(approvalFieldOverrideSchema).default([]),
  createdAt: z.string(),
  /** 后续审批引用的 ApprovalRecord id（用于 return / re-review） */
  references: z.array(z.string()).default([]),
});
export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;

export const DEMO_REVIEWER: ReviewerIdentity = {
  id: "demo-reviewer-001",
  name: "Demo Reviewer",
  role: "safety-officer",
  demo: true,
};

export interface AwaitingApprovalSnapshot {
  runId: string;
  status: ApprovalStatus;
  pendingItems: ReadonlyArray<{
    id: string;
    title: string;
    severity: "info" | "warning" | "block";
    ownerRole: ApproverRole;
    canBypass: boolean;
  }>;
  /** 已存在的 ApprovalRecord，按时间倒序 */
  history: ReadonlyArray<ApprovalRecord>;
  updatedAt: string;
}

export interface ApprovalTransitionResult {
  status: ApprovalStatus;
  record: ApprovalRecord;
  /** 是否所有必需项目都已通过 */
  fullyCleared: boolean;
  /** 剩余未决 / 等待的人工复核条目 id 列表 */
  pendingItemIds: ReadonlyArray<string>;
}
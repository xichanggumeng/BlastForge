/**
 * Report Module —— 报告生成。
 *
 * 职责：
 *  - 根据同一个 WorkflowRun 生成结构化 Report；
 *  - 报告内容必须来自 Run 内部数据，不得重新随机生成；
 *  - 支持 Markdown / JSON / HTML 三种导出格式；
 *  - 报告封面、引用、人工复核状态、安全边界必须齐全。
 */

import { z } from "zod";

import type { PlanningRun } from "@/modules/parameter-planning/domain/contracts";
import type { Citation } from "@/modules/agent-runtime/core/contracts";
import type { AwaitingApprovalSnapshot } from "@/modules/human-review/domain";

export const reportSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  /** 富文本 / Markdown 内容 */
  body: z.string(),
});
export type ReportSection = z.infer<typeof reportSectionSchema>;

export const reportStatusSchema = z.enum([
  "draft",
  "pending-review",
  "approved",
  "archived",
]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportSchema = z.object({
  id: z.string(),
  /** 关联 Run id（来自同一个 Planning Run；不重新生成） */
  runId: z.string(),
  /** 关联项目名（来自 input / preset） */
  projectName: z.string(),
  /** 关联场景名 */
  scenarioName: z.string(),
  /** 报告状态 */
  status: reportStatusSchema,
  /** 是否为回放模式生成 */
  replay: z.boolean(),
  /** 报告章节 */
  sections: z.array(reportSectionSchema),
  /** 引用列表 */
  citations: z.array(z.unknown()),
  /** 人工复核快照（可能为空） */
  approval: z.unknown().nullable(),
  /** 报告责任人 */
  generatedBy: z.string(),
  /** 报告生成时间 */
  createdAt: z.string(),
  /** 报告最近更新时间 */
  updatedAt: z.string(),
  /** 安全 / 责任边界说明 */
  responsibilityBoundary: z.string(),
});
export type Report = z.infer<typeof reportSchema>;

export interface BuildReportInput {
  run: PlanningRun;
  citations: ReadonlyArray<Citation>;
  approval: AwaitingApprovalSnapshot | null;
  generatedBy?: string;
  replay?: boolean;
}
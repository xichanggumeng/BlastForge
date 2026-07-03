import "server-only";

/**
 * Approval Service —— 状态机 + 存储。
 *
 * 注意：
 *  - 默认实现为 InMemory；可替换为 Drizzle / PostgreSQL；
 *  - 状态机严格区分 accept / modify / reject / return；
 *  - Agent 不得跳过人工确认节点。
 */

import { randomUUID } from "node:crypto";

import {
  approvalRecordSchema,
  DEMO_REVIEWER,
  type ApprovalFieldOverride,
  type ApprovalRecord,
  type ApprovalStatus,
  type ApprovalTransitionResult,
  type AwaitingApprovalSnapshot,
  type ReviewerIdentity,
} from "./contracts";

interface AwaitingApproval {
  runId: string;
  pendingItemIds: ReadonlyArray<string>;
  items: AwaitingApprovalSnapshot["pendingItems"];
  history: ApprovalRecord[];
  updatedAt: string;
}

class HumanApprovalService {
  private readonly store = new Map<string, AwaitingApproval>();

  register(args: {
    runId: string;
    items: AwaitingApprovalSnapshot["pendingItems"];
  }): AwaitingApprovalSnapshot {
    const pendingIds = args.items.filter((i) => i.severity !== "info").map((i) => i.id);
    const snapshot: AwaitingApproval = {
      runId: args.runId,
      pendingItemIds: pendingIds,
      items: args.items,
      history: [],
      updatedAt: new Date().toISOString(),
    };
    this.store.set(args.runId, snapshot);
    return this.toSnapshot(snapshot);
  }

  list(runId: string): AwaitingApprovalSnapshot | null {
    const item = this.store.get(runId);
    return item ? this.toSnapshot(item) : null;
  }

  /** 列出所有等待确认的 Run，用于 Dashboard / Review center */
  listAll(): ReadonlyArray<AwaitingApprovalSnapshot> {
    return Array.from(this.store.values()).map((s) => this.toSnapshot(s));
  }

  transition(args: {
    runId: string;
    checklistItemId: string;
    action: "accept" | "modify-accept" | "reject" | "return";
    reviewer?: ReviewerIdentity;
    comment?: string;
    overrides?: ReadonlyArray<ApprovalFieldOverride>;
  }): ApprovalTransitionResult {
    const item = this.store.get(args.runId);
    if (!item) {
      throw new Error(`Run ${args.runId} 没有等待中的 Approval。`);
    }
    if (!item.pendingItemIds.includes(args.checklistItemId)) {
      throw new Error(`ChecklistItem ${args.checklistItemId} 不在 pending 列表中。`);
    }
    const reviewer = args.reviewer ?? DEMO_REVIEWER;
    const status: ApprovalStatus =
      args.action === "accept"
        ? "accepted"
        : args.action === "modify-accept"
          ? "accepted-with-modifications"
          : args.action === "reject"
            ? "rejected"
            : "returned";

    const record: ApprovalRecord = approvalRecordSchema.parse({
      id: `apr-${randomUUID()}`,
      runId: args.runId,
      checklistItemId: args.checklistItemId,
      status,
      reviewer,
      comment: args.comment ?? "",
      overrides: args.overrides ?? [],
      createdAt: new Date().toISOString(),
      references: [],
    });

    const history = [record, ...item.history];

    if (status === "rejected" || status === "returned") {
      // 返回 / 驳回：保留 pending，后续仍可重审；记录 references
      const updated: AwaitingApproval = {
        ...item,
        history,
        updatedAt: record.createdAt,
      };
      this.store.set(args.runId, updated);
      return {
        status,
        record,
        fullyCleared: false,
        pendingItemIds: updated.pendingItemIds,
      };
    }

    // 接受 / 修改后接受：从 pending 列表中移除该 item
    const pendingItemIds = item.pendingItemIds.filter((id) => id !== args.checklistItemId);
    const updated: AwaitingApproval = {
      ...item,
      pendingItemIds,
      history,
      updatedAt: record.createdAt,
    };
    this.store.set(args.runId, updated);
    return {
      status: pendingItemIds.length === 0 ? "accepted" : "waiting_for_approval",
      record,
      fullyCleared: pendingItemIds.length === 0,
      pendingItemIds,
    };
  }

  /** 移除 Run 上的 Approval（如已通过 / 取消） */
  clear(runId: string): void {
    this.store.delete(runId);
  }

  private toSnapshot(item: AwaitingApproval): AwaitingApprovalSnapshot {
    const stillPending = new Set(item.pendingItemIds);
    return {
      runId: item.runId,
      status: stillPending.size === 0 ? "accepted" : "waiting_for_approval",
      pendingItems: item.items.filter((i) => stillPending.has(i.id)),
      history: [...item.history],
      updatedAt: item.updatedAt,
    };
  }
}

let instance: HumanApprovalService | null = null;
export function getHumanApprovalService(): HumanApprovalService {
  if (!instance) instance = new HumanApprovalService();
  return instance;
}

/** 测试 / Demo 重置 */
export function resetHumanApprovalService(): void {
  instance = null;
}
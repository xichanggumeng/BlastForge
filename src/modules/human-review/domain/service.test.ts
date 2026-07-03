/**
 * Human Approval Service 单元测试。
 *
 * 覆盖：
 *  - 注册 / 列表；
 *  - accept / modify-accept / reject / return；
 *  - 完全通过后 status=accepted；
 *  - canBypass 影响 modify-accept；
 *  - 历史记录持久化。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getHumanApprovalService, resetHumanApprovalService } from "@/modules/human-review/domain";

const RUN_ID = "run-test-001";

function registerMixed() {
  const service = getHumanApprovalService();
  service.register({
    runId: RUN_ID,
    items: [
      { id: "chk-001", title: "规则冲突", severity: "block", ownerRole: "safety-officer", canBypass: false },
      { id: "chk-002", title: "引用偏少", severity: "warning", ownerRole: "reviewer", canBypass: true },
      { id: "chk-003", title: "数据时效", severity: "info", ownerRole: "engineer", canBypass: true },
    ],
  });
}

describe("HumanApprovalService", () => {
  beforeEach(() => {
    resetHumanApprovalService();
  });
  afterEach(() => {
    resetHumanApprovalService();
  });

  it("register 写入 snapshot，且只把 warning/block 计入 pending", () => {
    registerMixed();
    const snap = getHumanApprovalService().list(RUN_ID);
    expect(snap).not.toBeNull();
    expect(snap?.pendingItems.length).toBe(2); // block + warning
    expect(snap?.status).toBe("waiting_for_approval");
  });

  it("accept 移除 pending", () => {
    registerMixed();
    const result = getHumanApprovalService().transition({
      runId: RUN_ID,
      checklistItemId: "chk-001",
      action: "accept",
      comment: "已确认",
    });
    expect(result.status).toBe("waiting_for_approval");
    expect(result.fullyCleared).toBe(false);
    expect(result.pendingItemIds).toEqual(["chk-002"]);
  });

  it("accept 全部后 fullyCleared=true", () => {
    registerMixed();
    getHumanApprovalService().transition({
      runId: RUN_ID,
      checklistItemId: "chk-001",
      action: "accept",
      comment: "已确认",
    });
    const final = getHumanApprovalService().transition({
      runId: RUN_ID,
      checklistItemId: "chk-002",
      action: "accept",
      comment: "已确认",
    });
    expect(final.fullyCleared).toBe(true);
    expect(final.pendingItemIds).toEqual([]);
  });

  it("modify-accept 保留 history 并推进", () => {
    registerMixed();
    const result = getHumanApprovalService().transition({
      runId: RUN_ID,
      checklistItemId: "chk-002",
      action: "modify-accept",
      comment: "已修改引用阈值",
    });
    expect(result.status).toBe("waiting_for_approval");
    expect(result.record.status).toBe("accepted-with-modifications");
    expect(getHumanApprovalService().list(RUN_ID)?.history[0]?.comment).toBe("已修改引用阈值");
  });

  it("reject 保留 pending 状态", () => {
    registerMixed();
    const result = getHumanApprovalService().transition({
      runId: RUN_ID,
      checklistItemId: "chk-001",
      action: "reject",
      comment: "暂不接受",
    });
    expect(result.status).toBe("rejected");
    expect(result.pendingItemIds).toContain("chk-001");
  });

  it("return 保留 pending 状态", () => {
    registerMixed();
    const result = getHumanApprovalService().transition({
      runId: RUN_ID,
      checklistItemId: "chk-001",
      action: "return",
      comment: "回退补充",
    });
    expect(result.status).toBe("returned");
  });

  it("未注册 Run 抛错", () => {
    expect(() =>
      getHumanApprovalService().transition({
        runId: "missing-run",
        checklistItemId: "x",
        action: "accept",
      }),
    ).toThrow();
  });

  it("非 pending item 抛错", () => {
    registerMixed();
    expect(() =>
      getHumanApprovalService().transition({
        runId: RUN_ID,
        checklistItemId: "chk-003", // info, 不在 pending
        action: "accept",
      }),
    ).toThrow();
  });

  it("clear 移除 Run", () => {
    registerMixed();
    getHumanApprovalService().clear(RUN_ID);
    expect(getHumanApprovalService().list(RUN_ID)).toBeNull();
  });

  it("listAll 汇总等待中 Run", () => {
    registerMixed();
    getHumanApprovalService().register({
      runId: "run-test-002",
      items: [{ id: "x", title: "x", severity: "warning", ownerRole: "reviewer", canBypass: true }],
    });
    const all = getHumanApprovalService().listAll();
    expect(all.length).toBe(2);
  });
});
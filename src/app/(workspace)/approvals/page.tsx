import { ClipboardCheck, ShieldAlert, UserCheck } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { SectionHeader } from "@/components/feedback/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { WorkspacePage } from "@/components/layout/workspace-page";

import { ApprovalBoard } from "@/components/human-review/approval-board";

import { getHumanApprovalService } from "@/modules/human-review/domain";
import { formatDateTime } from "@/lib/format";

export const metadata = {
  title: "人工复核",
};

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  const service = getHumanApprovalService();
  const pending = service.listAll().filter((s) => s.status === "waiting_for_approval");

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Human-in-the-Loop"
        title="人工复核中心"
        description="Agent 不得自动通过该节点；所有高风险 / 阻断级条目必须由具备资质的人员确认。"
        icon={ClipboardCheck}
        meta={
          <>
            <Badge tone="primary">Demo Reviewer</Badge>
            <Badge tone={pending.length > 0 ? "warning" : "success"}>
              {pending.length} 项等待中
            </Badge>
          </>
        }
      />

      <section aria-labelledby="approval-policy" className="flex flex-col gap-4">
        <SectionHeader
          title="规则与责任边界"
          description="评审节点属于应用责任边界的一部分；自动放行属于禁止动作。"
        />
        <Card tone="elevated" padding="lg">
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-danger" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">高风险阻断</span>
                  <span className="text-xs text-muted-foreground">
                    环境敏感等级=高 / 城镇隧道 / 关键规则冲突 / 高风险参数等条目在 Safety Reviewer 中标记为 block，必须人工签收。
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <UserCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">Demo Reviewer</span>
                  <span className="text-xs text-muted-foreground">
                    无真实身份认证时统一登记为 Demo Reviewer（role=safety-officer）；
                    数据结构支持后续接入 SSO / OAuth。
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <ClipboardCheck className="mt-0.5 h-4 w-4 text-accent" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">完整审计</span>
                  <span className="text-xs text-muted-foreground">
                    每条审批都保存 reviewer / comment / overrides / 时间戳，并参与最终报告生成。
                  </span>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="approval-list" className="flex flex-col gap-4">
        <SectionHeader
          title="待确认 Run"
          description="Agent Runtime 注册到 Approval Service 的等待节点；可逐项 Accept / Modify-accept / Reject / Return。"
        />
        {pending.length === 0 ? (
          <EmptyState
            title="暂无等待中的人工复核"
            description="前往 Planner 启动一次 Workflow，或在 Agent 失败阻断时返回此处。"
            icon={ClipboardCheck}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((snap) => (
              <Card key={snap.runId} tone="elevated" padding="lg">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">Run {snap.runId.slice(-8)}</CardTitle>
                    <Badge tone="warning">
                      {snap.pendingItems.length} 项待确认 · 更新于 {formatDateTime(snap.updatedAt)}
                    </Badge>
                  </div>
                  <CardDescription>
                    历史审批 {snap.history.length} 条；通过 / 驳回都会写入报告与审计。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ApprovalBoard snapshot={snap} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </WorkspacePage>
  );
}
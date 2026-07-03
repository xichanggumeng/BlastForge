/**
 * Workflow 视图页面：
 * - 展示预录制 Run（种子数据）与最近 Run（通过 /api/agent/runs 拉取）；
 * - 通过 React Flow 渲染节点 / 连线 / 状态；
 * - 移动端使用 Bottom Sheet 风格简化视图（由 WorkflowFlow 内置）。
 *
 * Phase 3 落地后，本页只承担：页面标题、能力摘要卡、Two-Tab 容器；具体能力在
 * `WorkflowViewerClient` 中通过 useWorkflowStream 订阅 /api/agent/runs/stream，
 * 由 workflow.* / agent.* / tool.* 事件直接驱动节点状态与脉冲。
 */

import { Activity, Eye, Network, MousePointerClick } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { DemoModeBadge } from '@/components/feedback/demo-mode-badge';
import { PageHeader } from '@/components/feedback/page-header';
import { SectionHeader } from '@/components/feedback/section-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WorkspacePage } from '@/components/layout/workspace-page';
import { WorkflowViewerClient } from '@/components/workflow/workflow-viewer-client';

import { DEMO_REPLAY_RUNS } from '@/server/demo/workflow-replays';

export const metadata = {
  title: 'Workflow',
};

export default function WorkflowPage() {
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Agentic Workflow"
        title="Workflow 执行视图"
        description="实时可视化 Agent / Tool / Step 执行状态；节点状态由 Workflow 事件流实时驱动；支持预录制 Run。"
        icon={Activity}
        meta={
          <>
            <Badge tone="primary">React Flow</Badge>
            <Badge tone="outline">{DEMO_REPLAY_RUNS.length} 预录制 Run</Badge>
            <DemoModeBadge />
          </>
        }
      />

      <WorkflowViewerClient replays={DEMO_REPLAY_RUNS} />

      <section aria-labelledby="workflow-features" className="flex flex-col gap-4">
        <SectionHeader
          title="可视化能力"
          description="点击节点查看 Tool、引用、Trace 摘要；running 节点脉冲；高风险自动 blocked。"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={Network}
            title="节点 + 连线"
            description="10 个步骤按顺序排列；状态驱动颜色；Pulse 动画仅在 running 时启用，并尊重 prefers-reduced-motion。"
          />
          <FeatureCard
            icon={Activity}
            title="事件流驱动"
            description="订阅 workflow.* / agent.* / tool.* 事件；断线后可从 RunRepository 恢复最终状态。"
          />
          <FeatureCard
            icon={Eye}
            title="降级与回放"
            description="Provider 不可用时自动回放预录制 Run；显式 replay=1 时强制走回放；顶部徽章明确标识。"
          />
          <FeatureCard
            icon={MousePointerClick}
            title="节点详情面板"
            description="点击节点查看 Tool 调用列表 / 知识引用 / Trace 摘要 / 输出摘要；review.blocked 自动 focus 对应节点。"
          />
        </div>
      </section>
    </WorkspacePage>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card tone="default" padding="md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
import { SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/feedback/page-header";
import { Badge } from "@/components/ui/badge";
import { WorkspacePage } from "@/components/layout/workspace-page";

import { PlannerWorkbench } from "@/components/planner/planner-workbench";

export const metadata = {
  title: "参数规划",
};

export default function PlannerPage() {
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="核心工作台"
        title="爆破参数预测与方案规划"
        description="录入工程条件，启动确定性 Demo Workflow，对比推荐 / 备选 / 风险方案；所有预测数据均标注为 Demo 模拟预测。"
        icon={SlidersHorizontal}
        meta={
          <>
            <Badge tone="primary">Phase 2 核心闭环</Badge>
            <Badge tone="outline">demo · 确定性</Badge>
          </>
        }
      />
      <PlannerWorkbench initialPresetId="standard" />
    </WorkspacePage>
  );
}

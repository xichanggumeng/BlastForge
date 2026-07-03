import { Activity, ArrowUpRight, BookOpen, Layers, MapPin, Workflow as WorkflowIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/feedback/status-badge";
import { RiskBadge } from "@/components/feedback/risk-badge";
import { CountUp } from "@/components/motion/count-up";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import type { DashboardDemoSnapshot } from "@/types/dashboard";
import type { DemoProject } from "@/types/demo";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

interface DashboardCurrentProjectProps {
  project: DemoProject;
  snapshot: DashboardDemoSnapshot;
}

const SCENARIO_LABEL: Record<DemoProject["scenario"], string> = {
  standard: "常规方案",
  complex: "复杂约束",
  "high-risk": "高风险拦截",
};

const SCENARIO_DESCRIPTION: Record<DemoProject["scenario"], string> = {
  standard: "参数完整、规则无冲突，Workflow 顺畅执行。",
  complex: "存在炮孔含水、环境敏感等多重约束，触发多方案对比。",
  "high-risk": "参数缺失或存在规则冲突，Safety Reviewer 阻断。",
};

export function DashboardCurrentProject({
  project,
  snapshot,
}: DashboardCurrentProjectProps) {
  const completion = Math.round(snapshot.completionRatio * 100);
  const approvals = snapshot.approvedSchemes;

  return (
    <RevealOnScroll className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          当前 Demo 项目
        </span>
        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {project.name}
        </h2>
      </header>

      <Card tone="elevated" padding="lg" className="overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-4">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    <span>{project.site}</span>
                  </div>
                  <CardTitle>{project.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={project.status} />
                  <RiskBadge level={project.risk} />
                  <Badge tone="outline">{SCENARIO_LABEL[project.scenario]}</Badge>
                </div>
              </div>
              <CardDescription>{project.summary}</CardDescription>
            </CardHeader>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CurrentStat
                icon={Activity}
                label="方案完成度"
                value={
                  <CountUp
                    value={completion}
                    digits={0}
                    suffix="%"
                    durationMs={1100}
                  />
                }
                hint="推荐 + 备选 + 风险方案"
                tone="primary"
              />
              <CurrentStat
                icon={Layers}
                label="已批准方案"
                value={<CountUp value={approvals} digits={0} durationMs={900} />}
                hint="通过人工复核"
                tone="accent"
              />
              <CurrentStat
                icon={BookOpen}
                label="知识引用"
                value={
                  <CountUp
                    value={snapshot.citationsThisWeek}
                    digits={0}
                    durationMs={1300}
                  />
                }
                hint="本周命中片段"
                tone="success"
              />
              <CurrentStat
                icon={WorkflowIcon}
                label="运行 Run"
                value={<CountUp value={1} digits={0} durationMs={400} />}
                hint="主 Workflow · 第 4 步"
                tone="neutral"
              />
            </div>

            <CardContent className="gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>规划进度</span>
                <span className="tabular text-foreground">{completion}%</span>
              </div>
              <Progress
                value={completion}
                tone={project.risk === "high" ? "warning" : "primary"}
              />
              <p className="text-xs text-muted-foreground">
                {SCENARIO_DESCRIPTION[project.scenario]}
              </p>
            </CardContent>
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 lg:w-72">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              一键进入
            </span>
            <p className="text-sm text-muted-foreground">
              从参数规划工作台直接打开当前 Demo 工程，预填 Phase 2 表单。
            </p>
            <Button asChild>
              <Link href="/planner" className="inline-flex items-center gap-2">
                <span>启动参数规划</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>最近更新</span>
              <span className="tabular text-foreground">
                {formatDateTime(project.updatedAt)}
              </span>
            </div>
          </aside>
        </div>
      </Card>
    </RevealOnScroll>
  );
}

interface CurrentStatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone: "primary" | "accent" | "success" | "neutral";
}

function CurrentStat({ icon: Icon, label, value, hint, tone }: CurrentStatProps) {
  const toneClass = cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-md border",
    tone === "primary" && "border-primary/40 bg-primary/10 text-primary",
    tone === "accent" && "border-accent/40 bg-accent/10 text-accent",
    tone === "success" && "border-success/40 bg-success/10 text-success",
    tone === "neutral" && "border-border bg-muted text-muted-foreground",
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className={toneClass} aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <span className="tabular text-xl font-semibold leading-tight text-foreground">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  );
}
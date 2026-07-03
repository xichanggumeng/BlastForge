import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import type { DashboardRecentReport } from "@/types/dashboard";
import { formatDateTime } from "@/lib/format";

interface DashboardRecentReportsProps {
  reports: readonly DashboardRecentReport[];
}

const STATUS_TONE: Record<
  DashboardRecentReport["status"],
  "neutral" | "warning" | "success" | "outline"
> = {
  draft: "neutral",
  "pending-review": "warning",
  approved: "success",
  archived: "outline",
};

const STATUS_LABEL: Record<DashboardRecentReport["status"], string> = {
  draft: "草稿",
  "pending-review": "待复核",
  approved: "已批准",
  archived: "已归档",
};

export function DashboardRecentReports({ reports }: DashboardRecentReportsProps) {
  return (
    <RevealOnScroll className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          最近报告
        </span>
        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {reports.length} 份 Demo 报告就绪
        </h2>
      </header>

      <ul className="flex flex-col gap-3" role="list">
        {reports.map((report) => (
          <li key={report.id}>
            <Card tone="elevated" padding="md" className="gap-3">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-accent" aria-hidden />
                    {report.title}
                  </CardTitle>
                  <Badge tone={STATUS_TONE[report.status]}>
                    {STATUS_LABEL[report.status]}
                  </Badge>
                </div>
                <CardDescription>
                  {report.size} · {formatDateTime(report.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  预览（Phase 5）
                </Button>
                <Button variant="ghost" size="sm" disabled>
                  下载（Phase 5）
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </RevealOnScroll>
  );
}
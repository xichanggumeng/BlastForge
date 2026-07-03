import { AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RiskBadge } from "@/components/feedback/risk-badge";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import type { DashboardRiskAlert } from "@/types/dashboard";
import { formatDateTime } from "@/lib/format";

interface DashboardRiskAlertsProps {
  alerts: readonly DashboardRiskAlert[];
}

const TONE_BY_RISK = {
  high: "border-danger/40 bg-danger/5 text-danger",
  medium: "border-warning/40 bg-warning/5 text-warning",
  low: "border-success/40 bg-success/5 text-success",
  unknown: "border-border bg-muted/30 text-muted-foreground",
} as const;

export function DashboardRiskAlerts({ alerts }: DashboardRiskAlertsProps) {
  return (
    <RevealOnScroll className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          风险提醒
        </span>
        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {alerts.length} 条提醒待处理
        </h2>
      </header>

      <ul className="flex flex-col gap-3" role="list">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <Card
              tone="outline"
              padding="md"
              className={`gap-3 ${TONE_BY_RISK[alert.risk]}`}
            >
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    {alert.title}
                  </CardTitle>
                  <RiskBadge level={alert.risk} />
                </div>
                <CardDescription className="text-muted-foreground">
                  {formatDateTime(alert.raisedAt)}
                  {alert.projectId ? ` · ${alert.projectId}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {alert.detail}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </RevealOnScroll>
  );
}
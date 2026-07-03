import { Clock, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RiskBadge } from "@/components/feedback/risk-badge";
import { RevealOnScroll } from "@/components/motion/reveal-on-scroll";
import type { DashboardPendingReview } from "@/types/dashboard";
import { formatDateTime } from "@/lib/format";

interface DashboardPendingReviewProps {
  reviews: readonly DashboardPendingReview[];
}

export function DashboardPendingReview({ reviews }: DashboardPendingReviewProps) {
  return (
    <RevealOnScroll className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          待人工复核
        </span>
        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {reviews.length} 项请求等待确认
        </h2>
        <p className="text-sm text-muted-foreground">
          Safety Reviewer 在高风险或边界条件下请求人工介入；Phase 2 起支持一键回退到录入页。
        </p>
      </header>

      <ul className="flex flex-col gap-3" role="list">
        {reviews.map((review) => (
          <li key={review.id}>
            <Card tone="elevated" padding="md" className="gap-3">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ShieldAlert
                      className="h-4 w-4 text-warning"
                      aria-hidden
                    />
                    {review.title}
                  </CardTitle>
                  <RiskBadge level={review.risk} />
                </div>
                <CardDescription>
                  <Badge tone="outline">{review.requestedBy}</Badge>
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    <span>{formatDateTime(review.requestedAt)}</span>
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {review.reason}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </RevealOnScroll>
  );
}
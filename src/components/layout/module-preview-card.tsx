import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export interface ModulePreviewCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  tone?: "primary" | "accent" | "neutral";
  bullets?: readonly string[];
  footer?: ReactNode;
  className?: string;
}

const TONE_MAP = {
  primary: {
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    iconBorder: "border-primary/40",
  },
  accent: {
    iconBg: "bg-accent/10",
    iconText: "text-accent",
    iconBorder: "border-accent/40",
  },
  neutral: {
    iconBg: "bg-muted",
    iconText: "text-muted-foreground",
    iconBorder: "border-border",
  },
} as const;

export function ModulePreviewCard({
  title,
  description,
  icon: Icon,
  badge,
  tone = "primary",
  bullets,
  footer,
  className,
}: ModulePreviewCardProps) {
  const styles = TONE_MAP[tone];
  return (
    <Card tone="elevated" padding="lg" className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span
            aria-hidden
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border",
              styles.iconBg,
              styles.iconBorder,
              styles.iconText,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          {badge ? <Badge tone="outline">{badge}</Badge> : null}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {bullets && bullets.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {bullets.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <ArrowRight
                className="mt-1 h-3 w-3 shrink-0 text-primary"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
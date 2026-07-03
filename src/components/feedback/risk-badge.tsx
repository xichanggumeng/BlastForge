import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types/demo";

const META: Record<RiskLevel, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  low: { label: "低风险", tone: "success" },
  medium: { label: "中风险", tone: "warning" },
  high: { label: "高风险", tone: "danger" },
  unknown: { label: "风险未知", tone: "neutral" },
};

const ICONS = {
  low: ShieldCheck,
  medium: ShieldAlert,
  high: ShieldAlert,
  unknown: ShieldQuestion,
} as const;

export function RiskBadge({ level }: { level: RiskLevel }) {
  const meta = META[level];
  const Icon = ICONS[level];
  return (
    <Badge tone={meta.tone} aria-label={`风险等级：${meta.label}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}
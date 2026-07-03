import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { RUNTIME_CONFIG } from "@/config/env-public";

export function DemoModeBadge({ className }: { className?: string }) {
  if (!RUNTIME_CONFIG.demoMode) return null;
  return (
    <Badge tone="accent" className={className} aria-label="当前为演示模式">
      <Sparkles className="h-3 w-3" aria-hidden />
      演示模式
    </Badge>
  );
}
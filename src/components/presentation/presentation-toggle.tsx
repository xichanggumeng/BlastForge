"use client";

import { MonitorPlay, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePresentationStore } from "@/stores/presentation-store";
import { cn } from "@/lib/cn";

interface PresentationToggleProps {
  className?: string;
}

/**
 * Compact toggle that flips presentation mode on / off. Renders inside
 * any workspace page header.
 */
export function PresentationToggle({ className }: PresentationToggleProps) {
  const enabled = usePresentationStore((s) => s.enabled);
  const toggle = usePresentationStore((s) => s.toggle);

  return (
    <Button
      size="sm"
      variant={enabled ? "primary" : "outline"}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "退出演示模式" : "进入大屏展示模式"}
      className={cn("gap-1.5", className)}
    >
      {enabled ? (
        <>
          <Square className="h-3.5 w-3.5" aria-hidden />
          <span>退出大屏</span>
        </>
      ) : (
        <>
          <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
          <span>大屏展示</span>
        </>
      )}
    </Button>
  );
}

/**
 * Alias used in PageHeader `actions` slot to keep the dashboard code concise.
 */
export const PresentationLauncher = PresentationToggle;
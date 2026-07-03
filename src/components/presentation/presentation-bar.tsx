"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Eye, EyeOff, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePresentationStore } from "@/stores/presentation-store";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/lib/cn";

const STEPS = NAV_ITEMS.slice(0, 5).map((item, idx) => ({
  index: idx + 1,
  label: item.label,
  description: item.description,
  href: item.href,
}));

/**
 * Demo script bar visible in presentation mode. Provides:
 * - 自动 / 手动进度（仅在大屏模式下启用）；
 * - 章节切换按钮；
 * - 重置 / 暂停。
 *
 * 组件重置时机：`enabled` 切回 false，下一次再打开会重新从第 1 步开始。
 */
export function PresentationScriptBar() {
  const enabled = usePresentationStore((s) => s.enabled);
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const total = STEPS.length;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev >= total ? 1 : prev + 1));
    }, 6000);
    return () => window.clearInterval(timer);
  }, [playing, total]);

  if (!enabled) return null;

  return (
    <div
      role="region"
      aria-label="演示脚本"
      className="sticky bottom-4 z-20 mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          演示脚本 · 第 {step} / {total} 步
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={playing ? "暂停脚本" : "继续脚本"}
            onClick={() => setPlaying((prev) => !prev)}
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="回到第一步"
            onClick={() => setStep(1)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ol className="flex flex-col gap-1.5" role="list">
        {STEPS.map((entry) => {
          const isActive = entry.index === step;
          return (
            <li key={entry.href} role="listitem">
              <button
                type="button"
                onClick={() => setStep(entry.index)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="tabular w-6 text-center font-mono">
                  {String(entry.index).padStart(2, "0")}
                </span>
                <span className="flex flex-1 flex-col leading-tight">
                  <span className="font-medium">{entry.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <EyeOff className="h-3 w-3" aria-hidden />
          退出大屏后自动隐藏
        </span>
        <span>{playing ? "自动播放中" : "已暂停"}</span>
      </div>
    </div>
  );
}
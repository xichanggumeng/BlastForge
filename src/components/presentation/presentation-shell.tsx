"use client";

import { useEffect } from "react";
import { Maximize2, Minimize2, MonitorPlay, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { usePresentationStore } from "@/stores/presentation-store";
import { cn } from "@/lib/cn";

/**
 * Wraps workspace children with a fullscreen-friendly container when
 * presentation mode is enabled. Press `Esc` (or click the close button)
 * to exit.
 *
 * The shell is rendered for every `(workspace)` route via `layout.tsx`,
 * so it does not need to be repeated in individual pages.
 */
export function PresentationShell({ children }: { children: React.ReactNode }) {
  const enabled = usePresentationStore((s) => s.enabled);
  const setEnabled = usePresentationStore((s) => s.setEnabled);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEnabled(false);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.dataset.presentation = "true";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.documentElement.dataset.presentation;
    };
  }, [enabled, setEnabled]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (enabled) {
      document.documentElement.dataset.presentation = "true";
    } else {
      delete document.documentElement.dataset.presentation;
    }
  }, [enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "relative isolate -mx-4 -my-6 min-h-[calc(100vh-3.5rem)] px-4 py-6 lg:-mx-8 lg:-my-10 lg:px-8 lg:py-10",
        "bg-background text-foreground",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-30"
      />
      <PresentationBar />
      <div className="mx-auto w-full max-w-[1600px]">{children}</div>
    </div>
  );
}

function PresentationBar() {
  const setEnabled = usePresentationStore((s) => s.setEnabled);

  const onExit = () => setEnabled(false);

  const requestFullscreen = () => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen();
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/80 px-4 py-2 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MonitorPlay className="h-4 w-4 text-primary" aria-hidden />
        <span>大屏展示模式</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          · 按 Esc 退出
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">驾驶舱</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/planner">参数规划</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={requestFullscreen}>
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          全屏
        </Button>
        <Button size="sm" variant="ghost" onClick={onExit}>
          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          退出
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="退出演示模式"
          onClick={onExit}
          className="sm:hidden"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
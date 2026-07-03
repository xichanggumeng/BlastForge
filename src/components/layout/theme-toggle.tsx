"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/system/theme-provider";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const label =
    mode === "system"
      ? "当前跟随系统主题，点击切换为深色"
      : mode === "dark"
        ? "切换为浅色主题"
        : "切换为深色主题";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface p-0.5",
        className,
      )}
      role="group"
      aria-label="主题切换"
    >
      {(
        [
          { key: "light", icon: Sun, label: "浅色" },
          { key: "dark", icon: Moon, label: "深色" },
          { key: "system", icon: Monitor, label: "跟随系统" },
        ] as const
      ).map(({ key, icon: ItemIcon, label: tip }) => {
        const active = mode === key;
        return (
          <Button
            key={key}
            size="sm"
            variant={active ? "primary" : "ghost"}
            onClick={() => setMode(key)}
            aria-pressed={active}
            aria-label={tip}
            className="h-7 px-2 text-xs"
          >
            <ItemIcon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{tip}</span>
          </Button>
        );
      })}
      <span className="sr-only">{label}</span>
    </div>
  );
}
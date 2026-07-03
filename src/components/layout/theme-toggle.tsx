"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/system/theme-provider";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * 紧凑圆形主题切换按钮 —— 用于移动端 sidebar 底部。
 * 一个圆圈，内部是图标，无字，点击在 light / dark 之间切换。
 */
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";
  const nextLabel = isDark ? "切换为浅色主题" : "切换为深色主题";
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggle}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        "h-10 w-10 rounded-full border border-border bg-surface shadow-sm hover:bg-muted",
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}

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
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-1",
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
            leftIcon={<ItemIcon className="h-3.5 w-3.5" aria-hidden />}
            className="h-7 whitespace-nowrap px-2.5 text-xs"
          >
            {tip}
          </Button>
        );
      })}
      <span className="sr-only">{label}</span>
    </div>
  );
}
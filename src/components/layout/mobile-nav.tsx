"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { NAV_ITEMS } from "@/config/nav";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DemoModeBadge } from "@/components/feedback/demo-mode-badge";

import { useSidebar } from "./sidebar-context";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

const MOBILE_BOTTOM_KEYS = NAV_ITEMS.filter(
  (item) => item.key !== "workflow",
).map((item) => item.href);

export function MobileNav() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // 同步 mobileOpen 到原生 <dialog> 的 open / close，避免 CSS transform 与可见性漂移
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (mobileOpen && !el.open) {
      el.showModal();
    } else if (!mobileOpen && el.open) {
      el.close();
    }
  }, [mobileOpen]);

  // 抽屉打开时禁止 body 滚动，松手关闭后恢复
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="移动端导航"
      className={cn(
        "fixed inset-0 z-[60] m-0 h-screen max-h-screen w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-overlay lg:hidden",
      )}
      onClose={() => setMobileOpen(false)}
      onClick={(event) => {
        // 点击空白遮罩时关闭（点击 <aside> 内部不触发）
        if (event.target === dialogRef.current) setMobileOpen(false);
      }}
    >
      <aside
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-lg transition-transform duration-base motion-reduce:duration-0 data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full"
        data-state={mobileOpen ? "open" : "closed"}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="text-sm font-semibold text-foreground">导航菜单</span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="关闭导航菜单"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar variant="mobile" />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <DemoModeBadge />
          <ThemeToggle />
        </div>
      </aside>
    </dialog>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  const itemCount = MOBILE_BOTTOM_KEYS.length;

  return (
    <nav
      aria-label="移动端底部导航"
      style={{ gridTemplateColumns: `repeat(${itemCount}, minmax(0, 1fr))` }}
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {MOBILE_BOTTOM_KEYS.map((href) => {
        const item = NAV_ITEMS.find((entry) => entry.href === href);
        if (!item) return null;
        const active = isActive(pathname, item.href);
        return (
          <BottomLink
            key={href}
            href={item.href}
            label={item.shortLabel}
            ariaLabel={item.label}
            icon={item.icon}
            active={active}
          />
        );
      })}
    </nav>
  );
}

function BottomLink({
  href,
  label,
  ariaLabel,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  ariaLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5")} aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname.startsWith("/dashboard");
  return pathname === href || pathname.startsWith(`${href}/`);
}
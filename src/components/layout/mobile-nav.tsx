"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 lg:hidden",
        mobileOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!mobileOpen}
    >
      <div
        onClick={() => setMobileOpen(false)}
        className={cn(
          "absolute inset-0 bg-overlay transition-opacity duration-base",
          mobileOpen ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-lg transition-transform duration-base",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-label="移动端导航"
        aria-modal="true"
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
    </div>
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
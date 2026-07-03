"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { ComponentType } from "react";

import { NAV_ITEMS, type NavItem } from "@/config/nav";
import { cn } from "@/lib/cn";
import { useSidebar } from "./sidebar-context";

interface SidebarProps {
  variant?: "desktop" | "mobile";
}

export function Sidebar({ variant = "desktop" }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, setMobileOpen } = useSidebar();

  const onNavigate = () => {
    if (variant === "mobile") setMobileOpen(false);
  };

  return (
    <nav
      aria-label="主导航"
      className={cn(
        "flex flex-col gap-1",
        variant === "desktop"
          ? "hidden lg:flex lg:gap-1 lg:p-3"
          : "flex w-full gap-1 p-3",
      )}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.key}
          item={item}
          active={isActive(pathname, item.href)}
          collapsed={variant === "desktop" ? collapsed : false}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon as ComponentType<{ className?: string }>;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? `${item.label} · ${item.description}` : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-border bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        collapsed && "lg:justify-center lg:px-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-surface text-foreground",
          active
            ? "border-primary/40 text-primary"
            : "border-border text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col leading-tight",
          collapsed && "lg:hidden",
        )}
      >
        <span className="truncate font-medium">{item.label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {item.description}
        </span>
      </span>
      {active ? (
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-primary",
            collapsed && "lg:hidden",
          )}
          aria-hidden
        />
      ) : null}
    </Link>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname.startsWith("/dashboard");
  return pathname === href || pathname.startsWith(`${href}/`);
}
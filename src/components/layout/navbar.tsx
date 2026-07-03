"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, PanelLeft, PanelLeftClose } from "lucide-react";

import { BRAND } from "@/config/brand";
import { DemoModeBadge } from "@/components/feedback/demo-mode-badge";

import { Button } from "@/components/ui/button";
import { useSidebar } from "./sidebar-context";
import { ThemeToggle } from "./theme-toggle";
import { MobileAccessButton } from "./mobile-access-button";

export function Navbar() {
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();

  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6"
      role="banner"
    >
      <div className="flex flex-1 items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="lg:hidden"
          aria-label="打开导航菜单"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="hidden lg:inline-flex"
          aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
          aria-pressed={collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>

        <Link
          href="/"
          className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-border bg-surface shadow-sm">
            <Image
              src={BRAND.icon.src}
              alt={BRAND.icon.alt}
              width={BRAND.icon.width}
              height={BRAND.icon.height}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide text-foreground sm:text-base">
              {BRAND.name}
            </span>
            <span className="hidden text-[11px] text-muted-foreground md:block">
              {BRAND.tagline}
            </span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <DemoModeBadge className="hidden sm:inline-flex" />
        <MobileAccessButton className="hidden md:inline-flex" />
        <ThemeToggle className="hidden sm:inline-flex" />
        <div className="flex items-center gap-1 sm:hidden">
          <DemoModeBadge />
        </div>
      </div>
    </header>
  );
}
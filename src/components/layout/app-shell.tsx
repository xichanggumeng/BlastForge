"use client";

import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { MobileNav, MobileBottomNav } from "./mobile-nav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <ShellInner>{children}</ShellInner>
    </SidebarProvider>
  );
}

function ShellInner({ children }: AppShellProps) {
  const { collapsed, setMobileOpen } = useSidebar();

  // ESC closes mobile drawer
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMobileOpen]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <MobileNav />
      <div className="flex min-w-0 flex-1">
        <aside
          aria-label="桌面侧栏"
          className={cn(
            "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden border-r border-border bg-surface/60 transition-[width] duration-base lg:block",
            collapsed ? "w-16" : "w-64",
          )}
        >
          <div className="h-full w-full overflow-y-auto">
            <Sidebar />
          </div>
        </aside>
        <main
          id="main-content"
          className="relative min-w-0 flex-1 overflow-x-hidden pb-24 lg:pb-10"
          tabIndex={-1}
        >
          <div className="w-full min-w-0 px-4 py-6 lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
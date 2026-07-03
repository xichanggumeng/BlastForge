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
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <Navbar />
      <MobileNav />
      <div className="flex min-w-0 flex-1">
        <aside
          aria-label="桌面侧栏"
          className={cn(
            // 桌面端：fixed 定位，始终占据左侧不滚动
            "sticky top-14 z-40 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden border-r border-border bg-surface/60 transition-[width] duration-base lg:fixed lg:top-14 lg:bottom-0 lg:left-0 lg:block",
            collapsed ? "lg:w-16" : "lg:w-64",
          )}
        >
          <div className="h-full w-full overflow-y-auto">
            <Sidebar />
          </div>
        </aside>
        {/* 占位元素：宽 = sidebar 展开宽度（lg）—— 因为侧栏 fixed 离开文档流，
            必须有等宽 placeholder 顶住 main 内容不会左移。 */}
        <div
          aria-hidden
          className={cn(
            "hidden shrink-0 lg:block",
            collapsed ? "lg:w-16" : "lg:w-64",
          )}
        />
        <main
          id="main-content"
          className={cn(
            // 桌面端：navbar/sidebar fixed 离开文档流，
            //   - main 高度 = 100vh（与父容器 h-screen 一致），padding-top 让出 navbar
            //   - main 左侧 placeholder div 已让出 sidebar 宽度
            //   - main 自身 overflow-y-auto ⇒ 只有主容器滚动
            // 移动端：保持原有行为（root 整页滚动，MobileBottomNav fixed）。
            "relative min-w-0 flex-1 overflow-x-hidden pb-24 pt-0 lg:h-screen lg:overflow-y-auto lg:pb-10 lg:pt-14",
          )}
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
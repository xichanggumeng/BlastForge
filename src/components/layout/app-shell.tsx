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
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Navbar />
      <MobileNav />
      {/* min-h-0 让 flex row 子项能被父级高度约束，没有它 main 的 flex-1 无法触发 overflow-y-auto。 */}
      <div className="flex min-h-0 min-w-0 flex-1">
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
            // 桌面端 + 移动端：navbar fixed (h-14) 离开文档流，
            //   - main 顶部 pt-14 让出 navbar 高度
            //   - main 左侧 placeholder div (lg: 才存在) 让出 sidebar 宽度
            //   - 移动端 main 底部 pb-24 让出 MobileBottomNav 高度
            //   - 桌面端 lg:pb-10 让出常规底部留白
            //   - main 自身 overflow-y-auto + 父容器 h-screen ⇒ 只有主容器滚动
            // min-h-0 必须存在，否则 flex item 的 min-height = auto，
            // 内容过高时 main 高度被撑大，overflow-y-auto 不触发。
            "relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-24 pt-14 lg:pb-10",
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
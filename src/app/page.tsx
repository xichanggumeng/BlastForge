import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/config/brand";
import { NAV_ITEMS } from "@/config/nav";

export const metadata = {
  title: "爆擎 BlastForge",
  description: BRAND.tagline,
};

export default function HomePage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] gradient-brand"
      />

      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 py-16 lg:gap-24 lg:py-24">
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
            <span>{BRAND.shortName} · 模拟商业展示 Demo</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {BRAND.name}
            <span className="mt-2 block text-xl font-normal leading-snug text-muted-foreground sm:text-2xl">
              {BRAND.tagline}
            </span>
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            将工程参数规划、专业知识检索、多 Agent 协同、风险复核与报告生成整合为一条
            可执行、可解释、可追踪的智能工作流。当前 Demo 默认以深色工业科技主题展示。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">
                <span className="inline-flex items-center gap-2">
                  <span>进入驾驶舱</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/workflow">
                <span>查看 Workflow</span>
              </Link>
            </Button>
            <Badge tone="primary" className="text-xs">
              Phase 1 · 视觉与骨架
            </Badge>
          </div>
        </section>

        <section aria-labelledby="home-modules" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2
              id="home-modules"
              className="text-2xl font-semibold leading-tight text-foreground"
            >
              平台六大工作台
            </h2>
            <p className="text-sm text-muted-foreground">
              所有工作台均可在左侧导航直接访问；Phase 1 阶段呈现结构骨架与基础数据。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card
                  tone="elevated"
                  padding="lg"
                  className="h-full transition-colors group-hover:border-primary/40"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <span
                        aria-hidden
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary"
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <ArrowRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                    </div>
                    <CardTitle>{item.label}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge tone="outline" className="font-mono text-[11px]">
                      {item.href}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {BRAND.name} · 当前为模拟演示，所有结果仅供方案讨论与会议展示。
          </span>
          <span>Phase 1 · 项目基础、设计系统与应用骨架</span>
        </footer>
      </main>
    </div>
  );
}
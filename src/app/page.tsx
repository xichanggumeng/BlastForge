import type { Metadata } from "next";

import { BrandMark } from "@/components/showcase/brand-mark";
import { ShowcaseAgentNetwork } from "@/components/showcase/showcase-agent-network";
import { COMPACT_TOPOLOGY } from "@/components/showcase/showcase-agent-topology";
import { ShowcaseArchitecture } from "@/components/showcase/showcase-architecture";
import { ShowcaseCapabilities } from "@/components/showcase/showcase-capabilities";
import { ShowcaseCta } from "@/components/showcase/showcase-cta";
import { ShowcaseAgentPool } from "@/components/showcase/showcase-agent-pool";
import { ShowcaseFlow } from "@/components/showcase/showcase-flow";
import { ShowcaseFooter } from "@/components/showcase/showcase-footer";
import { ShowcaseHero } from "@/components/showcase/showcase-hero";
import { ShowcaseMetrics } from "@/components/showcase/showcase-metrics";
import { ShowcaseSafety } from "@/components/showcase/showcase-safety";

export const metadata: Metadata = {
  title: "爆擎 BlastForge",
  description: "AI 原生爆破工程辅助决策与协同平台",
};

export default function HomePage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] gradient-brand"
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-12 lg:gap-24 lg:py-16">
        <nav
          aria-label="顶部导航"
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <BrandMark />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">v0.2.0 · 模拟商业展示</span>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span>Demo 数据就绪</span>
          </div>
        </nav>

        <ShowcaseHero />

        <ShowcaseMetrics />

        <ShowcaseFlow />

        <ShowcaseCapabilities />

        <section
          aria-labelledby="showcase-network-title"
          className="flex flex-col gap-4"
        >
          <header className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
              Agent 协作可视化
            </span>
            <h2
              id="showcase-network-title"
              className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
            >
              一张图理解 BlastForge Agent 协作
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              6 列简化拓扑：工程条件 → Supervisor 编排 → 知识检索 / 规划评分 → Safety 复核 → 报告归档。
              完整 9 节点拓扑详见上方 Hero 区。
            </p>
          </header>
          <ShowcaseAgentNetwork
            topology={COMPACT_TOPOLOGY}
            title="6 节点核心链路"
            description="Mobile 友好布局，连接线展示数据流方向"
            variant="compact"
          />
        </section>

        <ShowcaseAgentPool />

        <ShowcaseSafety />

        <ShowcaseArchitecture />

        <ShowcaseCta />

        <ShowcaseFooter />
      </main>
    </div>
  );
}
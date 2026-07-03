# Session 2 Handoff · 品牌展示首页、智能驾驶舱与展示动画

> 对应任务书：五阶段开发中的 Phase 2（品牌 + 驾驶舱 + 演示基础设施）。
> 时间：2026-07-04
> 工作分支：直接在仓库工作区执行（未新建分支）。

## 1. 完成内容

### 1.1 新增依赖

- `motion@^12.42.2`（含 `framer-motion` 子依赖）—— 统一动画与轻交互；
- `echarts@^6.1.0` —— 驾驶舱数据可视化；
- `zustand@^5.0.14` —— 客户端工作区状态（演示模式）；
- `zod@^4.4.3` —— 已预装但本会话暂未使用，Phase 3 起正式启用。

新增 npm script：

- `npm run typecheck`（`tsc --noEmit`）。

`lucide-react@^1.23.0` 与 React 19 / Next.js 16 不变。

### 1.2 动画基础设施

- `src/lib/motion.ts` —— `useReducedMotion()` 与 `useMotionDuration()`，SSR-safe。
- `src/components/motion/count-up.tsx` —— `CountUp` 组件，支持 IntersectionObserver 触发、`prefers-reduced-motion` 直接跳到目标值。
- `src/components/motion/reveal-on-scroll.tsx` —— `RevealOnScroll` 包装，进入视口时滑入；通过 `motion/react` 渲染，reduced motion 时降级为静态 `<div>`。

### 1.3 数据可视化

- `src/lib/chart-theme.ts` —— 从 CSS Variables 读取主题色，缓存 + `invalidateChartThemeCache()` 适配主题切换；提供 `axisGrid()` 与 `tooltip()` 公共 ECharts Option 片段。
- `src/components/dashboard/charts/__types.ts` —— 纯类型模块（`AgentStageDatum` / `RiskDistributionDatum` / `TaskTrendSeries` 等）。
- `src/components/dashboard/charts/agent-stage-chart.tsx` —— 阶段耗时柱状图，色调随耗时自动切换。
- `src/components/dashboard/charts/risk-distribution-chart.tsx` —— 环形图带中心总数。
- `src/components/dashboard/charts/task-trend-chart.tsx` —— 多系列折线图 + 主系列面积渐变。
- `src/components/dashboard/charts/chart-skeleton.tsx` —— SSR 友好的图表占位骨架。
- `src/components/dashboard/charts/dashboard-charts.tsx` —— `next/dynamic` 包装，统一按需加载 + `ChartSkeleton` 占位。

### 1.4 Dashboard 数据与组件

- `src/types/dashboard.ts` —— 集中类型：`DashboardAgentActivity / DashboardRecentTask / DashboardPendingReview / DashboardRiskAlert / DashboardKnowledgeCitation / DashboardRecentReport / DashboardDemoSnapshot`。
- `src/server/demo/dashboard.ts` —— `loadDashboardSnapshot()`，覆盖 Agent 池、Run 时间线、待复核、风险、知识引用、报告与图表数据。
- `src/components/dashboard/dashboard-current-project.tsx` —— 当前 Demo 项目卡（指标 + 进度 + 一键进入参数规划）。
- `src/components/dashboard/dashboard-agent-activity.tsx` —— Agent 池活跃状态（负载 + 平均耗时）。
- `src/components/dashboard/dashboard-recent-tasks.tsx` —— Run 时间线。
- `src/components/dashboard/dashboard-pending-review.tsx` —— 待人工复核清单。
- `src/components/dashboard/dashboard-risk-alerts.tsx` —— 风险提醒列表。
- `src/components/dashboard/dashboard-knowledge-strip.tsx` —— 知识引用网格。
- `src/components/dashboard/dashboard-recent-reports.tsx` —— 最近报告列表。

驾驶舱页面 `src/app/(workspace)/dashboard/page.tsx` 全面重写为：

1. PageHeader（含演示模式入口按钮）；
2. 4 张 MetricCard（Phase 1 指标）；
3. `DashboardCurrentProject`；
4. TaskTrend + RiskDistribution 双图区；
5. AgentStageChart 阶段耗时；
6. DashboardRecentTasks + DashboardPendingReview 双列；
7. DashboardAgentActivityPanel；
8. DashboardKnowledgeStrip；
9. DashboardRiskAlerts + DashboardRecentReports 双列；
10. StatHighlight 高亮栏（动画递增）。

### 1.5 品牌展示首页

- `src/app/page.tsx` 重写为完整的 Showcase Landing Page：
  - 顶部 BrandMark + 状态指示；
  - Hero（含 Hero 标题、CTA、6 列 9 节点 Agent 协作网络 SVG）；
  - ShowcaseMetrics（6 项核心指标 CountUp 动画）；
  - ShowcaseFlow（输入 → Agent 协作 → 方案与报告 三段）；
  - ShowcaseCapabilities（六大能力模块，2x3 grid）；
  - 6 节点紧凑 Agent 协作网络（compact variant）；
  - ShowcaseAgentPool（6 个核心 Agent 预览）；
  - ShowcaseSafety（安全与人工复核四要素）；
  - ShowcaseArchitecture（六层架构矩阵）；
  - ShowcaseCta（最终 CTA）；
  - ShowcaseFooter。

### 1.6 Agent 协作可视化

- `src/components/showcase/showcase-agent-topology.ts` —— 类型 + 两套拓扑（SHOWCASE_TOPOLOGY 9 节点 / COMPACT_TOPOLOGY 6 节点）。
- `src/components/showcase/showcase-agent-network.tsx` —— SVG 渲染：节点圆 + 脉冲 + 标签 + Supervisor 激活点 + 沿线动画点（`animateMotion`）。
- `src/components/showcase/brand-mark.tsx` —— 复用的品牌标识。

动画严格遵循规范：

- 仅 `transform` + `opacity`；
- `prefers-reduced-motion` 时退化为静态；
- 不使用粒子背景；
- Mobile 自动切到 6 节点紧凑拓扑。

### 1.7 演示模式 / Presentation Mode

- `src/stores/presentation-store.ts` —— Zustand `persist` 中间件，`enabled / toggle / setEnabled`，key = `blastforge.presentation`。
- `src/components/presentation/presentation-shell.tsx` —— `(workspace)` layout 内的全屏容器；`Esc` 退出；`document.documentElement.dataset.presentation` 同步状态。
- `src/components/presentation/presentation-toggle.tsx` —— `PresentationToggle` + 别名 `PresentationLauncher`，PageHeader 内调用。
- `src/components/presentation/presentation-bar.tsx` —— 可选 `PresentationScriptBar`，5 步脚本 + 自动播放 + 暂停 / 重置（组件本地状态，不持久化）。

### 1.8 UI 组件增量

- `src/components/ui/progress.tsx` —— SSR 友好的进度条（aria + tone + size）。

### 1.9 文档 / 状态

- `docs/STATUS.md` 增量更新到 Phase 2 中期；
- `docs/TASKS.md` 勾选 Phase 2 中"动画 / 图表 / 演示模式"前置项；
- `docs/DECISIONS.md` 追加 ADR-004（按需加载图表与 Motion）；
- `docs/handoffs/session-2.md`（本文件）。

## 2. 关键文件

### 2.1 新增 / 重写

- `src/app/page.tsx`（重写：完整 Showcase Landing Page）
- `src/app/(workspace)/dashboard/page.tsx`（重写：完整驾驶舱）
- `src/app/(workspace)/layout.tsx`（更新：嵌入 PresentationShell）
- `src/components/dashboard/{charts,dashboard-*}.tsx`（新增 11 个组件）
- `src/components/motion/{count-up,reveal-on-scroll}.tsx`（新增）
- `src/components/presentation/{presentation-shell,presentation-toggle,presentation-bar}.tsx`（新增）
- `src/components/showcase/{brand-mark,showcase-*}.tsx`（新增 12 个组件）
- `src/components/ui/progress.tsx`（新增）
- `src/lib/{motion,chart-theme}.ts`（新增）
- `src/stores/presentation-store.ts`（新增）
- `src/types/dashboard.ts`（新增）
- `src/server/demo/dashboard.ts`（新增）
- `src/server/demo/loaders.ts`（更新：导出 `loadDashboardSnapshot`）

### 2.2 包配置

- `package.json` 新增 `motion` / `echarts` / `zustand` / `zod`；
- 新增 `npm run typecheck` 脚本。

## 3. 验证命令与结果

在仓库根 `c:\My\Programs\Project\BlastForge\Code\web` 执行：

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

实际结果：

- `npm install`：成功（新增 4 个依赖 + 传递依赖）。
- `npm run lint`：成功（exit 0，无 warning / error）。
- `npm run typecheck`：成功（exit 0）。
- `npm run build`：成功（Turbopack 编译 ~6.2s，TS 检查 ~4.1s，9 个静态页面 prerender）。

随后启动 `npx next start -p 3001`，所有路由命中：

```text
/                  200 (~118KB)
/dashboard         200 (~217KB)
/planner           200
/agents            200
/workflow          200
/knowledge         200
/reports           200
/Logo.jpg          200
/nonexistent       404
```

静态资源 `/Logo.jpg` 仍正常（首页 Showcase 不重复使用 Logo，Navbar 与 BrandMark 各保留一处）。

## 4. 性能 / 可访问性处理

- ECharts 通过 `next/dynamic` 关闭 SSR（`ssr: false`），避免首屏 bundle 包含 ~360KB ECharts；
- `ChartSkeleton` 在动态加载期间提供占位；
- 所有图表使用 CSS Variables 颜色 + 设计 Token 字体，跟随主题切换；
- `prefers-reduced-motion` 全局兜底外，`useReducedMotion()` 在 CountUp / RevealOnScroll / ShowcaseAgentNetwork 内部进一步降级；
- `next/image` 已在 Navbar / BrandMark 中使用；
- 所有 CTA / 图标按钮均设置 `aria-label` 或包裹可见文字；
- 仪表盘指标卡、CTA、卡片 Hover 状态全部使用 Tailwind transition (`duration-fast` / `duration-base`)；
- Tab 焦点环通过 `:focus-visible` 全局生效。

## 5. 新增组件 / 接口一览

| 组件 | 适用场景 | 关键能力 |
| --- | --- | --- |
| `ShowcaseHero` | 首页 Hero | Hero 标题 motion + 9 节点 Agent 网络 + 数字递增 |
| `ShowcaseMetrics` | 首页指标 | 6 项 CountUp，触发即动画 |
| `ShowcaseFlow` | 首页叙事 | 输入 → Agent → 方案 三段动画 |
| `ShowcaseCapabilities` | 首页能力 | 六大能力模块卡片 |
| `ShowcaseAgentPool` | 首页 Agent 预览 | 6 Agent 卡片 |
| `ShowcaseSafety` | 首页安全 | Safety / Human-in-loop / 标识 / 边界 |
| `ShowcaseArchitecture` | 首页架构 | 六层矩阵 |
| `ShowcaseCta` | 首页底部 CTA | 大号 CTA + 装饰 |
| `ShowcaseFooter` | 首页页脚 | 简单文案 |
| `ShowcaseAgentNetwork` | 任意 Agent 网络可视化 | SVG 拓扑 + 动画 + 紧凑变体 |
| `BrandMark` | 任意位置品牌标识 | Logo + 产品名组合 |
| `RevealOnScroll` | 全局 | 进入视口滑入 |
| `CountUp` | 数字指标 | 滚动触发动画 + reduced motion |
| `AgentStageChart` | 驾驶舱 | 阶段耗时柱状图 |
| `RiskDistributionChart` | 驾驶舱 | 风险环形图 + 中心总数 |
| `TaskTrendChart` | 驾驶舱 | 多系列趋势折线 |
| `ChartSkeleton` | 任意图表占位 | SSR 友好骨架 |
| `DashboardCurrentProject` | 驾驶舱 | 当前项目 + 进度 + CTA |
| `DashboardAgentActivityPanel` | 驾驶舱 | Agent 池活跃状态 |
| `DashboardRecentTasks` | 驾驶舱 | Run 时间线 |
| `DashboardPendingReview` | 驾驶舱 | 待人工复核 |
| `DashboardRiskAlerts` | 驾驶舱 | 风险提醒 |
| `DashboardKnowledgeStrip` | 驾驶舱 | 知识引用网格 |
| `DashboardRecentReports` | 驾驶舱 | 最近报告 |
| `Progress` | UI 基础 | SSR 友好进度条 |
| `PresentationShell` | `(workspace)` layout | 大屏模式容器 |
| `PresentationToggle` / `PresentationLauncher` | 任意页面 | 切换按钮 |
| `PresentationScriptBar` | 演示模式 | 5 步脚本 + 自动播放 |

可复用接口：

- `usePresentationStore`（Zustand）；
- `loadDashboardSnapshot()`；
- `getChartTheme()` + `invalidateChartThemeCache()`；
- `useReducedMotion()` / `useMotionDuration()`；
- 全部 dashboard section 组件均接受 `readonly` 数据，调用方无需关心 mutation。

## 6. 已知限制 / 显式延后

- Phase 2 暂未实现真实参数表单 / 预测算法，仅在驾驶舱"启动参数规划"按钮占位跳转 `/planner`（沿用 Phase 1 占位页）。
- `PresentationScriptBar` 未挂载到 `(workspace)/layout.tsx`（仅在显式引入时使用），避免每个页面都出现浮窗；后续 Phase 5 接入预录制 Run 时再统一挂载。
- 浅色主题下图表色板已自动跟随，但 ECharts 颜色缓存在首次读取后不会自动失效；切换主题后建议刷新一次浏览器（后续可监听 `data-theme` 触发 `invalidateChartThemeCache`）。
- 图表暂未实现窗口尺寸变化的真正 `resize`（仅监听 `window.resize`）；如未来需要虚拟化或父容器尺寸变化可改用 `ResizeObserver`。
- `next/image` 未对 Showcase 网络插图做单独优化（当前仅在 BrandMark / Navbar 使用 Logo）；Phase 5 演示回放若需大幅插图可再加 `sizes`。

## 7. 下一会话（Phase 2 余下 / Phase 3）可直接复用

- 展示层组件：`ShowcaseHero` / `ShowcaseCapabilities` / `ShowcaseFlow` 等都已基于 `motion/react`，可直接套到 Phase 5 演示回放页。
- 驾驶舱数据：`loadDashboardSnapshot` 已将图表数据集中导出；Phase 3 接入真实 Run 时只需替换数据来源，调用方签名不变。
- 演示模式：`usePresentationStore` 已可被任何 client 组件订阅，可在 Planner / Workflow 等页面加入"演示态"分支。
- 类型：`AgentStageDatum / RiskDistributionDatum / TaskTrendSeries` 已稳定，可直接喂给 Phase 3 真实图表数据。
- Motion 钩子：`useReducedMotion` 已在所有动画组件内强制检查；新增动画组件可直接复用。
# 当前开发状态

更新时间：2026-07-04（Phase 2 中段）

## 已完成

### Phase 1（视觉与骨架）

- Next.js 16 + React 19 + Tailwind CSS v4 项目骨架
- TypeScript Strict、ESLint、`tsc --noEmit` typecheck 脚本
- 设计 Token（深色工业科技主题 + 浅色主题）
- 公共组件库（Button、Surface、Card、Badge、Skeleton、Separator、PageHeader、SectionHeader、MetricCard、Status/Risk/DemoMode Badge、Empty/Error/Loading State、WorkspacePage、ModulePreviewCard、Progress）
- 响应式 App Shell（Navbar + Sidebar + MobileBottomNav + Mobile Drawer）
- 主题切换（dark / light / system，SSR-safe）
- 6 个主导航路由骨架（dashboard / planner / agents / workflow / knowledge / reports），全部含占位内容
- 品牌首页 Hero（Phase 1）+ 6 能力卡
- 全局 loading / error（含恢复动作） / not-found
- Demo 种子数据：3 项目 / 8 Agent / 10 Workflow Step / 4 Knowledge Doc / 3 Report
- `.env.example` 仅含两个公开变量

### Phase 2（已落地的部分）

- 动画基础设施：`motion@12` + `CountUp` + `RevealOnScroll`，全部 SSR-safe + 兼容 `prefers-reduced-motion`
- 图表基础设施：`echarts@6` + 设计 Token 主题 + `next/dynamic` 按需加载 + `ChartSkeleton`
  - `AgentStageChart` / `RiskDistributionChart` / `TaskTrendChart`
- 演示模式：`usePresentationStore` + `PresentationShell` + `PresentationToggle` + `PresentationScriptBar`
- 驾驶舱完整化：当前 Demo 项目 / 最近任务 / Agent 池 / 待复核 / 风险 / 知识引用 / 最近报告 + 三张图表 + 演示模式入口
- 品牌展示首页完整化：Hero（含 9 节点 Agent 协作网络） / Metrics / Flow / Capabilities / 6 节点紧凑网络 / Agent Pool / Safety / Architecture / CTA / Footer
- Dashboard 类型与 `loadDashboardSnapshot` 集中数据源（Phase 3 接入真实 Run 时可直接替换 loader）

## 正在进行

- Phase 2 余下：参数录入表单 / Zod Schema / 多方案对比中心（推迟到 Session 3）
- Phase 3：DeepSeek Provider Adapter / Agent Registry / Workflow Engine

## 当前可运行页面

- `/` 完整 Showcase Landing Page
- `/dashboard` 完整智能驾驶舱（带演示模式入口）
- `/planner` 参数规划（仍为占位，等待 Phase 2 余下）
- `/agents` Agent 工作台（基础版）
- `/workflow` Workflow 执行视图（静态列表）
- `/knowledge` 知识库（占位 + 4 份脱敏片段）
- `/reports` 报告中心（占位 + 3 份 Demo 报告）
- `/<unknown>` 全局 404

## 当前技术状态

- 包管理器：npm
- 数据库：尚未接入（Phase 2/4 引入）
- DeepSeek：尚未接入（Phase 3）
- Agent Runtime：尚未实现（Phase 3）
- Demo 数据：静态常量 + 集中 loader
- Motion / ECharts / Zustand：已引入
- TanStack Query / React Flow / Zod：TanStack Query 与 React Flow 暂未使用；Zod 已装但本会话暂未启用

## 已知问题

- 移动端底部导航暂隐藏 `Workflow` 一项（Phase 1 决定）
- 演示模式仅在驾驶舱 PageHeader 暴露入口；其他页面可通过 `usePresentationStore` 接入
- 浅色主题切换时图表颜色需刷新页面（缓存在 `chart-theme.ts`）
- `PresentationScriptBar` 已实现但未默认挂载；后续 Phase 5 接入预录制 Run 时统一启用

## 下一建议任务

- Session 3 可直接复用 `loadDashboardSnapshot` / `RevealOnScroll` / `CountUp` / `PresentationShell`，推进：
  1. 参数表单 + Zod Schema；
  2. 多方案对比中心；
  3. `PresentationScriptBar` 接入驾驶舱 / 方案对比页；
  4. 图表主题缓存随 `data-theme` 失效。
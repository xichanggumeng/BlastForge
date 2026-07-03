# 技术决策

## ADR-001：首期采用 Next.js 全栈单体

状态：已接受

原因：

- Demo 开发周期较短；
- 需要快速完成流式 AI 交互；
- 前后端共享 TypeScript 和 Zod Schema；
- 暂无独立扩缩容需求。

后续拆分条件：

- AI 任务需要独立扩缩容；
- Web 请求受到长任务影响；
- 出现多客户端复用 Agent API 的需求。

## ADR-002：Phase 1 使用 npm 而非 pnpm Workspace

状态：已接受（Phase 1 临时决定）

原因：

- 当前仓库已经锁定 `package-lock.json`；
- Phase 1 范围仅单 Next.js 应用，无工作区需求；
- 避免在 Demo 阶段引入 Turborepo / pnpm Workspace 增加复杂度。

后续阶段如需 monorepo：

- 评估时机：Phase 3 起引入 Agent / Tool 独立包时；
- 推荐组合：pnpm Workspace + Turborepo（参见 README 技术栈章节）；
- 迁移策略：以 `package.json` 拆分而非破坏性变更。

## ADR-003：Phase 1 设计 Token 与主题策略

状态：已接受

决策要点：

- 使用 Tailwind v4 的 `@theme inline` + CSS Variables；
- **默认主题切换为浅色（2026-07-04 修正，详见 ADR-005）**；完整保留深色作为可选主题；
- 主题切换支持 `dark / light / system`，由 `localStorage` 持久化；
- 通过内联 `ThemeScript` 在首屏前应用主题，避免闪烁与 hydration mismatch；
- 所有业务组件通过 token 引用颜色，禁止硬编码 hex。

后续影响：

- Phase 2 引入图表（ECharts）时，图表配色必须绑定 token；
- Phase 5 若需要演示模式或品牌切换，扩展点为 `data-theme` 值集合。

## ADR-005：默认主题改为浅色 + 图标位改用 Icon.ico

状态：已接受（2026-07-04）

原因：

- 用户反馈：浅色主题更适合商业会议展示与团队协同场景，避免深色在打印、屏幕分享与白底文档混排时的反差不一致；
- Logo.jpg 是品牌摄影图（非图标），不应进入导航 / 头部 / 列表等小尺寸图标位；图标统一使用 `Icon.ico`（已存在，53 KB，多尺寸）；
- `Logo.jpg` 仍保留为可选品牌展示资源，供营销页或品牌区按需引用。

实施要点：

- `globals.css`：`:root` 默认映射到浅色 token，深色迁到 `:root[data-theme="dark"]`；
- `theme-script.tsx` / `theme-provider.tsx`：默认 `mode` 与 `readStoredMode` fallback 改为 `light`；
- `config/brand.ts`：拆分为 `BRAND.icon`（图标用 `Icon.ico`）与 `BRAND.logo`（品牌图 `Logo.jpg`，仅作可选展示资源）；
- `Navbar`、`BrandMark`（Showcase 头部）：图标源切换到 `BRAND.icon.src`，`object-contain` 避免 `.ico` 拉伸；
- 浅色 token 的 `--shadow-*` 调低透明度以保持可读性，深色 token 不变。

后续影响：

- Phase 3-5 接入新页面或组件时，不要再使用 `Logo.jpg` 作为图标；如需展示品牌图，必须经 `BRAND.logo` 显式使用且带语义化 alt；
- 若未来需要增加第三种主题，扩展点仍是 `:root[data-theme="..."]` 与 `theme-provider` 的 `ThemeMode` 联合类型。

## ADR-004：Phase 2 动画与图表按需加载

状态：已接受

决策要点：

- 引入 `motion@^12`（含 `framer-motion`）作为统一动画入口；
- ECharts 通过 `next/dynamic` + `ssr: false` 在驾驶舱按需加载，配合 `ChartSkeleton` 占位；
- Zustand 仅承载"客户端工作区状态"（演示模式），不与 Server Component 数据耦合；
- 所有动画统一暴露 `useReducedMotion()` 降级路径；
- 图表配色通过 `lib/chart-theme.ts` 从 CSS Variables 读取，避免硬编码颜色；
- 演示模式通过 `data-presentation="true"` 与 `localStorage` 同步，Esc 退出。

后续影响：

- Phase 3 接入真实 Run 时，图表数据可通过 `loadDashboardSnapshot` 替换；
- Phase 5 演示模式可直接基于 `PresentationShell` + `PresentationScriptBar` 扩展；
- `invalidateChartThemeCache()` 在主题切换时尚未自动调用，可在 Phase 5 接入。
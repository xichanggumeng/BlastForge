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
- 默认深色主题（爆破橙 + 冷青 + 石墨黑），完整保留浅色；
- 主题切换支持 `dark / light / system`，由 `localStorage` 持久化；
- 通过内联 `ThemeScript` 在首屏前应用主题，避免闪烁与 hydration mismatch；
- 所有业务组件通过 token 引用颜色，禁止硬编码 hex。

后续影响：

- Phase 2 引入图表（ECharts）时，图表配色必须绑定 token；
- Phase 5 若需要演示模式或品牌切换，扩展点为 `data-theme` 值集合。
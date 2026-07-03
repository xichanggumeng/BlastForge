# Session 1 Handoff · 项目基础、设计系统与应用骨架

> 对应任务书：五阶段开发中的 Phase 1。
> 时间：2026-07-04
> 工作分支：直接在仓库工作区执行（未新建分支）。

## 1. 完成内容

### 1.1 工程结构与基础设施

- 保持单 Next.js 全栈单体，未拆 monorepo / 包。
- 新建目录：
  - `src/components/ui`（基础件：button / surface / card / badge / skeleton / separator）
  - `src/components/layout`（app-shell / navbar / sidebar / mobile-nav / sidebar-context / theme-toggle / workspace-page / module-preview-card）
  - `src/components/feedback`（page-header / section-header / metric-card / status-badge / risk-badge / demo-mode-badge / empty-state / error-state / loading-state）
  - `src/components/system`（theme-provider / theme-script）
  - `src/config`（brand / nav / env-public）
  - `src/lib`（cn / format / env）
  - `src/modules/*`（六个业务模块占位目录）
  - `src/server/demo`（loaders + seed）
  - `src/types`（demo / nav / ui）
- 别名沿用 `@/* → src/*`（已存在于 `tsconfig.json`）。

### 1.2 依赖

新增 `dependencies`：

- `clsx` 2.1.x
- `tailwind-merge` 3.6.x
- `class-variance-authority` 0.7.x
- `lucide-react` 1.23.x
- `@radix-ui/react-slot` 1.3.x

未引入：`tailwindcss-animate`、`framer-motion` / `motion`、`zustand`、`@tanstack/react-query`、`zod`、`echarts*`、`reactflow`、`react-hook-form`、`@ai-sdk/*`、`vitest`、`playwright` 等。

`devDependencies` 未变更。包管理器保持 **npm**（`package-lock.json`）。

### 1.3 品牌与元数据

- 项目名 `爆擎 BlastForge`，副标题 `AI 原生爆破工程辅助决策与协同平台`（`src/config/brand.ts`）。
- Navbar 通过 `next/image` 渲染 `public/Logo.jpg`（`width/height=36`、`priority`、`alt` 完整）。
- `public/Icon.ico` 作为站点 favicon；`public/Icon.jpg` 作为 Apple touch icon。
- 默认 `src/app/favicon.ico` 已删除，避免与 Next 模板默认图标冲突。
- `metadata.title` 模板 `'%s · 爆擎 BlastForge'`，`description` 来自副标题。
- `viewport.themeColor` 双值（dark + light）。

### 1.4 设计系统

- `src/app/globals.css` 重写为双主题 CSS Variables：
  - 深色：`#0B0F14` / 表面 `#111821` / 主色 `#F2871E` / 辅色 `#46C2D9` / 成功 `#3DBE8B` / 警告 `#F2B544` / 危险 `#E5484D`。
  - 浅色：`#F6F8FB` / 表面 `#FFFFFF` / 主色 `#C25A0F` / 辅色 `#0E7C8C`。
- 圆角 `--radius-sm/md/lg/xl`、阴影 `--shadow-sm/md/lg`、运动 `--duration-fast/base/slow` 全部 token 化。
- 暴露 Tailwind v4 `@theme inline`，业务组件全部使用 `bg-*` / `text-*` / `border-*` 等工具类，**未硬编码颜色**。
- 字体：保留 Geist Sans + Geist Mono；中文 fallback（PingFang SC / 微软雅黑）置于栈末位。
- 主题切换支持 dark / light / system，通过 `localStorage` 持久化；`ThemeScript` 内联在 `<head>` 中，避免闪烁与 hydration mismatch。

### 1.5 应用外壳

- `AppShell`（client）：`Navbar` + 桌面 `Sidebar`（可折叠，状态持久化）+ `MobileNav` 抽屉 + `MobileBottomNav`（5 项）。
- 主导航 6 项：`/dashboard` 总览、`/planner` 参数规划、`/agents` Agent 工作台、`/workflow` Workflow、`/knowledge` 知识库、`/reports` 报告中心。
- 路由分组 `(workspace)` 共享 AppShell；首页 `/` 独立布局。
- 当前激活路由在 Sidebar / MobileBottomNav 中均有视觉高亮（基于 `usePathname()`）。
- Navbar 包含 Logo、品牌名、副标题、`DemoModeBadge`（依赖 `NEXT_PUBLIC_DEMO_MODE`）、`ThemeToggle`、桌面侧栏折叠按钮。

### 1.6 公共组件

| 组件 | 关键能力 |
| --- | --- |
| `Button` | variants (primary/accent/outline/ghost/danger/link)；sizes；`loading`；`asChild`（Radix Slot，单 child 限制）；disabled 与 aria-busy |
| `Surface` | tone (default/elevated/outline/muted)；padding；可作 `div` 容器 |
| `Card` | 组合语义化：`CardHeader / CardTitle / CardDescription / CardContent / CardFooter` |
| `Badge` | tone (neutral/primary/accent/success/warning/danger/outline)；size |
| `StatusBadge` | 映射 ProjectStatus / AgentStatus / WorkflowStepStatus |
| `RiskBadge` | 低/中/高/未知风险 |
| `DemoModeBadge` | 由 `NEXT_PUBLIC_DEMO_MODE` 控制 |
| `Skeleton` | shimmer 动画 |
| `Separator` | 横/纵 |
| `PageHeader` | eyebrow / title / description / actions / meta / icon |
| `SectionHeader` | 标题 + 说明 + 操作位 |
| `MetricCard` | 指标 + 趋势 + 提示 + tone + icon |
| `EmptyState` / `ErrorState` / `LoadingState` | 图标 + 文案 + CTA 槽位 |
| `WorkspacePage` / `WorkspaceGrid` | 统一页面容器与响应式网格 |
| `ModulePreviewCard` | 能力占位卡片（用于 Phase 2+ 页面） |

### 1.7 页面与异常边界

- `app/page.tsx`：品牌首页 Hero，含品牌名、副标题、CTA、能力卡网格。
- `app/(workspace)/dashboard/page.tsx`：总览，使用真实 Demo 数据（指标 + 3 个项目卡）。
- `app/(workspace)/planner/page.tsx`、`agents/page.tsx`、`workflow/page.tsx`、`knowledge/page.tsx`、`reports/page.tsx`：均含 PageHeader + Demo 数据 / 占位卡，**不是空白页**。
- `app/loading.tsx`：全局骨架，含 LoadingState 与卡片骨架。
- `app/error.tsx`（client）：错误信息 + 重试 / 返回驾驶舱 / 回到首页按钮。
- `app/not-found.tsx`：404 + 返回驾驶舱 / 回到首页按钮。

### 1.8 状态与 Provider

- `ThemeProvider`：dark / light / system + `localStorage` + 内联 `ThemeScript` 提前应用主题；Provider 边界在 `(workspace)` route group 内（首页 `/` 不需要主题状态，仅消费 CSS 变量）。
- `SidebarProvider`：管理桌面折叠状态（持久化）+ 移动端抽屉开关。
- 不引入 Zustand / TanStack Query（任务书允许但不强制，本阶段不需要）。

### 1.9 Demo 基础数据

- 类型：`src/types/demo.ts`
  - `ProjectStatus / RiskLevel / AgentMode / AgentStatus / WorkflowStepStatus`
  - `DemoMetric / DemoProject / DemoAgent / DemoWorkflowStep / DemoWorkflowRun / DemoKnowledgeDoc / DemoReport`
- 种子：`src/server/demo/seed.ts`
  - 3 个项目（标准 / 复杂约束 / 高风险拦截）
  - 8 个 Agent（Supervisor / Normalizer / Retriever / Planner / Generator / Evaluator / Safety / Report）
  - 10 个 Workflow Step（与设计规范 §15.1 一致）
  - 4 份知识文档片段、3 份 Demo 报告、4 项驾驶舱指标
- 加载器：`src/server/demo/loaders.ts` 全部为静态常量。下一阶段可在不动调用方签名的情况下替换为内存或持久化存储。

### 1.10 项目文档

- `README.md`：
  - 本地开发小节改为 `npm` 命令；
  - 新增「项目结构」「设计 Token」「Demo 脚本入口」「已知限制」小节；
  - 移除旧的 `pnpm install / pnpm dev / pnpm db:*` 等不适用命令；
  - 常用命令改为 `npm run dev / build / start / lint`。
- `.env.example`：仅两个公开变量（`NEXT_PUBLIC_APP_NAME`、`NEXT_PUBLIC_DEMO_MODE`），未写入任何密钥。
- `docs/STATUS.md`：Phase 1 收尾状态。
- `docs/TASKS.md`：Phase 1 全部勾选完成。
- `docs/DECISIONS.md`：新增 ADR-002（npm vs pnpm）与 ADR-003（Phase 1 设计 Token 与主题策略）。
- `AGENTS.md` 未修改（任务书要求）。

## 2. 关键文件

### 2.1 新增 / 改写

- `src/app/layout.tsx`（重写：metadata、字体、ThemeScript）
- `src/app/globals.css`（重写：双主题 CSS Variables + Tailwind v4 @theme）
- `src/app/page.tsx`（重写：品牌首页）
- `src/app/loading.tsx`、`src/app/error.tsx`、`src/app/not-found.tsx`（新增）
- `src/app/(workspace)/layout.tsx`（新增：ThemeProvider + AppShell）
- `src/app/(workspace)/dashboard/page.tsx`（新增）
- `src/app/(workspace)/planner/page.tsx`（新增）
- `src/app/(workspace)/agents/page.tsx`（新增）
- `src/app/(workspace)/workflow/page.tsx`（新增）
- `src/app/(workspace)/knowledge/page.tsx`（新增）
- `src/app/(workspace)/reports/page.tsx`（新增）
- `src/components/ui/{button,surface,card,badge,skeleton,separator}.tsx`
- `src/components/layout/{app-shell,navbar,sidebar,mobile-nav,sidebar-context,theme-toggle,workspace-page,module-preview-card}.tsx`
- `src/components/feedback/{page-header,section-header,metric-card,status-badge,risk-badge,demo-mode-badge,empty-state,error-state,loading-state}.tsx`
- `src/components/system/{theme-provider,theme-script}.tsx`
- `src/config/{brand,nav,env-public}.ts`
- `src/lib/{cn,format,env}.ts`
- `src/server/demo/{seed,loaders}.ts`
- `src/types/{demo,nav,ui}.ts`
- `src/modules/{dashboard,planner,agents,workflow,knowledge,reports}/`（空目录占位）
- `public/` 中的默认 Next 模板 SVG（`next.svg` / `vercel.svg` / `file.svg` / `globe.svg` / `window.svg`）暂保留，未在 UI 中使用，可在后续清理。

### 2.2 删除

- `src/app/favicon.ico`（默认 Next 模板图标，已被 `public/Icon.ico` 替代）。

### 2.3 文档

- `README.md`（更新）
- `docs/STATUS.md`（更新）
- `docs/TASKS.md`（更新）
- `docs/DECISIONS.md`（追加 ADR-002 / ADR-003）
- `.env.example`（新增）
- `docs/handoffs/session-1.md`（本文件）

## 3. 新增依赖

```text
clsx                           2.1.x
tailwind-merge                 3.6.x
class-variance-authority       0.7.x
lucide-react                   1.23.x
@radix-ui/react-slot           1.3.x
```

> 备注：当前 npm registry 上 `lucide-react` 的 `latest` dist-tag 为 `1.23.0`（旧版本），含本会话使用的全部图标。后续如需迁移到上游主线版本（0.x），请在 Phase 2 评估。

## 4. 验证命令与结果

在仓库根 `c:\My\Programs\Project\BlastForge\Code\web` 执行：

```bash
npm install
npm run lint
npm run build
```

实际结果：

- `npm install`：成功（首次安装 + 新增 6 个依赖 + 若干间接依赖）。
- `npm run lint`：成功（exit 0，无 warning / error）。
- `npm run build`：成功（Turbopack 编译 ~3.2s，TS 检查 ~2.7s，9 个静态页面成功 prerender，含 `/`、`/_not-found`、`/dashboard`、`/planner`、`/agents`、`/workflow`、`/knowledge`、`/reports`）。

`npm run dev` 启动后 `http://localhost:3000` 响应 200，路由全部命中：

```text
/                  200 (62 KB)
/dashboard         200 (100 KB)
/planner           200 (96 KB)
/agents            200 (119 KB)
/workflow          200 (109 KB)
/knowledge         200 (81 KB)
/reports           200 (92 KB)
/nonexistent       404
```

静态资源：

```text
/Logo.jpg            200 (50 KB)
/Icon.ico            200 (53 KB)
/_next/image?...Logo  200 (621 B, image/jpeg)
```

无控制台错误；`data-theme` 切换正确（dark / light / system）。

## 5. 下一会话可直接复用的接口

- `useTheme()`：`src/components/system/theme-provider.tsx`；`mode` + `resolved` + `setMode` + `toggle`。
- `useSidebar()`：`src/components/layout/sidebar-context.tsx`；`collapsed` + `mobileOpen`。
- `<AppShell>` + `<WorkspacePage>` + `<WorkspaceGrid>`：workspace 页面的统一容器。
- `<MetricCard>`、`<PageHeader>`、`<SectionHeader>`、`<StatusBadge>`、`<RiskBadge>`、`<EmptyState>`、`<ErrorState>`、`<LoadingState>`：业务页面的标准组件。
- 类型：`src/types/demo.ts` 中所有导出。
- 加载器：`src/server/demo/loaders.ts`（Phase 2 可在不动签名情况下替换为 Server Action / 持久化）。
- 设计 Token：`globals.css` 中 `@theme inline` 是配色与节奏的唯一来源。
- 路由配置：`src/config/nav.ts`（`NAV_ITEMS`）驱动 Sidebar / BottomNav / 首页能力卡。
- 品牌常量：`src/config/brand.ts`（`BRAND.name / tagline / logo / favicon`）。

## 6. 已知问题 / 显式延后

- Phase 1 未引入 Motion / ECharts / React Flow / TanStack Query / Zustand / Zod / 表单库 / DeepSeek SDK；
- 移动端底部导航暂隐藏 `Workflow` 一项（抽屉中保留完整导航）；
- `lucide-react` 当前 `latest` dist-tag 指向 1.23.0；Phase 2 起如需切换到上游 0.x 版本，请评估；
- `next/image` 当前对 `Logo.jpg`（53KB）使用默认优化，Phase 2/3 视情况调整 `sizes`；
- 未启用 `typecheck` 与 `format` 脚本；当前仅 `lint` + `build`；
- 未启用 Vitest / Playwright；测试基础设施按 Phase 2/4/5 顺序引入；
- 未提供 i18n、多品牌色变体与预设主题切换（如 dark-blue、graphite 等）；当前仅 dark / light / system。
- ADR-002 明确 Phase 1 临时决定使用 npm；Phase 3 引入 Agent / Tool 独立包时再评估 pnpm Workspace + Turborepo。
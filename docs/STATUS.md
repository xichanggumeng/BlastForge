# 当前开发状态

更新时间：2026-07-04（Phase 3 / Session 4 收官 — Agent Runtime 接入；lint / typecheck / test / build 全部通过）

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

### Phase 2 / Session 3 — 参数规划核心工作台

- `src/modules/parameter-planning/` 落地 `domain / infrastructure` 分层与纯函数 Planner
- Zod 契约：`BlastScenarioInput` / `NormalizedParameterSet` / `PlanningRun` / `Scheme` / `SchemeScore` / `RiskItem` / `ReviewRequirement` 等；预留 `SourceKind` 字段
- 确定性 Demo Planner：`normalizeParameters` / `runRulePrecheck` / `planParameters` / `calculateSchemeScore` / `collectRisks` / `collectReviewRequirements` / `analyzeSensitivity`
- 三类预设场景：常规 / 复杂约束 / 高风险拦截；高风险自动进入 `blocked`
- Repository 接口 + In-Memory Demo 实现 + Drizzle Schema 蓝图；**无数据库可启动**
- `PlannerWorkbench`：Desktop 三栏（场景输入 / 方案与图表 / 风险与下一步），Mobile 步骤式（场景输入 → 参数确认 → 执行规划 → 方案对比 → 风险与确认）
- 表单 12 字段（React Hook Form + Zod），含草稿自动保存、单位、说明、必填 / 区间校验
- 6 步 Timeline（`validate_input → await_human_review`），可取消 / 重置，高风险自动 blocked
- 三类图表（雷达 / 柱图 / 敏感性热力图），均 ECharts 动态导入 + Tooltip 业务含义 + 选中方案联动
- Zustand `useSelectionStore` / `usePlannerUIStore` 分片；`/planner?preset=&scheme=&chart=` URL 同步
- `vitest` 35/35 通过；`typecheck` / `lint`（0 errors）/ `build`（9 routes）全部通过

### Phase 3 / Session 4 — Agent 架构核心

- Provider Adapter：`src/modules/agent-runtime/server/provider.ts` 实现 OpenAI-compatible DeepSeek 调用；服务端 only；统一 `LanguageModelProvider` 接口；流式 / 结构化输出 / Zod 校验；模型名从环境变量 `DEEPSEEK_MODEL` 读取，默认 `deepseek-v4-pro`；API Key 仅服务端访问。
- `.env.example` 扩展：`DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` / `DEMO_REPLAY_ENABLED` / `AI_REQUEST_TIMEOUT_MS`；明确禁止 `NEXT_PUBLIC_` 前缀与提交真实密钥。
- Agent Runtime 模块：
  - `Orchestrator / Supervisor` 串联 10 个 Step；
  - `Agent Registry`（8 个 Agent，每个含 id / name / description / model / mode / inputSchema / outputSchema / tools / maxSteps / timeoutMs / promptVersion / requiresApproval）；
  - `Workflow Engine`（10 个 Step Spec + 初始 Step 状态 + 从快照重建 + 阻断识别）；
  - `Tool Registry`（8 个 Tool，全部 Zod 校验；确定性计算复用 Session 3 纯函数；记录执行状态与耗时；不支持任意 SQL / Shell）；
  - `Context Builder`（通过 `PlanningPipelineInput` + Replay 数据组合 Agent 输入）；
  - `Guardrails`（每个 Tool / Agent 声明 highRisk + Schema 校验）；
  - `Human Approval` 接口（`request_human_approval` Tool）；
  - `Trace Recorder`（记录 TraceRecord 并暴露安全的 `FrontendTraceSummary`，不暴露 API Key / Prompt）；
  - `Replay / Degradation`：3 套预录制 Run（standard / complex / high-risk），Orchestrator 在 Provider 不可用 / 超时 / Schema 失败时自动降级。
- Workflow 事件：`workflow.started` / `step.started` / `agent.started` / `tool.called` / `tool.completed` / `citation.attached` / `step.completed` / `review.blocked` / `human.input_requested` / `human.approved` / `workflow.completed` / `workflow.failed`；每个事件含 `eventId` / `sequence` / `runId` / `timestamp` / `stepId` / 可选 `agentId` / `payload`；事件可持久化到 `RunRepository` 并通过 SSE 流式推送。
- 流式接口：`/api/agent/runs/stream` 使用 SSE；`/api/agent/runs/[id]` 查询最终状态；`/api/agent/runs/[id]/convert` 把 WorkflowRun 转回 `PlanningRun`；`DELETE` 取消 Run；超时通过 `AI_REQUEST_TIMEOUT_MS` 控制。
- Workflow 可视化：`/workflow` 用 React Flow 渲染 10 个节点 + 连线 + 状态（pending / running / succeeded / failed / blocked / waiting_for_approval）；点击节点打开详情面板（结构化输入 / 输出摘要 / Tool / 引用 / Trace 摘要 / 错误）；running 节点脉冲；Mobile 用 Bottom Sheet 简化视图；支持预录制 + 真实 Run 双 Tab。
- Agent 工作台：`/agents` 重写为完整页，展示 8 个 Agent（含 Schema / Tool / 版本）+ 8 个 Tool + 最近 Run + 预录制 Replay 入口。
- Planner 接入：`useAgentWorkflow` Hook 替换 `usePlanningExecution`（通过 `?agent=1` URL 或组件 prop 切换），服务端不可用时自动 fallback 到 `planDemo`；Planner 输出仍适配 Session 3 的 `PlanningRun` / `Scheme` 契约；**不破坏既有 Demo Planner**。
- 测试：Agent Definition Schema / Tool I/O / Workflow 状态流转 / Safety Reviewer 阻断 / 结构化输出失败 / Provider 降级 / Replay 事件顺序 / 流中断恢复 / 参数工作台到 Workflow 核心 E2E。Vitest 83/83 通过；`tsc --noEmit` 0 errors；`eslint` 0 errors；`next build` 成功（9 routes）。

## 正在进行

- Phase 4：知识库 / RAG 接入 + 真实数据库 + 多用户隔离（详见 `docs/handoffs/session-4.md`）
- `PresentationScriptBar` 挂载到驾驶舱 / 方案对比页（推迟到 Session 5）
- 图表主题随 `data-theme` 失效（推迟到 Session 5）

## 当前可运行页面

- `/` 完整 Showcase Landing Page
- `/dashboard` 完整智能驾驶舱（带演示模式入口）
- `/planner` **完整 Demo 工作台**（Agent Workflow 可选启用 + 自动降级 Demo Replay）
- `/agents` **Agent 工作台（完整版）**（8 Agent + 8 Tool + 最近 Run + Replay）
- `/workflow` **Workflow 执行视图（React Flow）**（预录制 + 真实 Run 双 Tab）
- `/knowledge` 知识库（占位 + 4 份脱敏片段）
- `/reports` 报告中心（占位 + 3 份 Demo 报告）
- `/api/agent/runs` 列出最近 Run
- `/api/agent/runs/stream` SSE 启动 Workflow Run
- `/api/agent/runs/[id]` 查询 / 取消 Run
- `/api/agent/runs/[id]/convert` WorkflowRun → PlanningRun
- `/<unknown>` 全局 404

## 当前技术状态

- 包管理器：npm
- 数据库：尚未接入；Session 4 提供 `RunRepository` 接口 + 内存实现，可平滑切换到 Drizzle
- DeepSeek：**已接入**（Provider Adapter + `server-only`）；默认降级 Demo Replay
- Agent Runtime：**已实现**（Orchestrator / Agent Registry / Tool Registry / Workflow Engine / Trace Recorder / Replay / Event Bus）
- Demo 数据：静态常量 + 集中 loader + In-Memory Repository
- Motion / ECharts / Zustand / React Hook Form / Zod / React Flow：均已启用
- TanStack Query：暂未使用（保留至 Phase 5）
- 测试：Vitest 83 条覆盖 Agent / Tool / Workflow / Replay / Server Config / Orchestrator

## 已知问题

- 移动端底部导航暂隐藏 `Workflow` 一项（Phase 1 决定）
- 浅色主题切换时图表颜色需刷新页面（缓存在 `chart-theme.ts`）
- `form.watch()` 触发 React Compiler 警告；功能不受影响
- `PresentationScriptBar` 已实现但未默认挂载；后续 Phase 5 接入预录制 Run 时统一启用
- 当前 Orchestrator 在 Provider 不可用时自动用 Replay；不会发起真实 API 调用
- 后端事件流改为 SSE（Next.js Route Handler + ReadableStream）；客户端 fetch 必须支持流式读取

## 下一建议任务

- Session 5：数据库（Drizzle + PostgreSQL + pgvector）/ 多用户隔离 / 真实知识库 + RAG 接入 / Workflow Engine 持久化升级
- Session 5+：`PresentationScriptBar` 接入驾驶舱 / 方案对比页 / Workflow 页
- Session 6：报表生成 / 人工审批签字 / 报告导出（PDF + Markdown）
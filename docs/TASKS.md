# 开发任务

## Phase 1：视觉与骨架

- [x] 建立 Design Token（CSS Variables + Tailwind v4 @theme）
- [x] 建立应用 Shell（Navbar + Sidebar + MobileBottomNav）
- [x] 实现桌面侧边栏（含折叠态）
- [x] 实现移动端导航（Drawer + BottomNav）
- [x] 实现主题切换（dark / light / system）
- [x] 公共组件库（PageHeader / SectionHeader / Surface / MetricCard / Badge 系列 / Empty / Error / Loading / Skeleton / Progress）
- [x] 6 个主路由骨架 + 全局 loading / error / not-found
- [x] Demo 基础数据（类型与种子常量）

## Phase 2：参数规划 + 展示基础设施

### 视觉与展示

- [x] 引入 Motion 与 ECharts（按需加载）
- [x] 设计 Token 化图表主题 + 主题切换适配
- [x] 统一动画钩子（`useReducedMotion`、`useMotionDuration`）
- [x] CountUp 数字递增组件
- [x] RevealOnScroll 滚动进入组件
- [x] 品牌首页完整化（Hero / Metrics / Flow / Capabilities / AgentPool / Safety / Architecture / CTA）
- [x] Agent 协作网络 SVG（9 节点 + 6 节点紧凑版）
- [x] 大屏展示模式（PresentationShell / Toggle / ScriptBar）
- [x] 浅色 / 深色主题完整支持，演示模式持久化

### 驾驶舱

- [x] Dashboard 类型与 `loadDashboardSnapshot` 集中数据源
- [x] 当前 Demo 项目卡（含进度、指标、CTA）
- [x] Agent 池活跃状态面板
- [x] 最近 Run 时间线
- [x] 待人工复核清单
- [x] 风险提醒列表
- [x] 知识引用网格
- [x] 最近报告列表
- [x] 三张图表（任务趋势 / 风险分布 / 阶段耗时）
- [x] PageHeader 增加演示模式入口

### 待 Phase 2 余下 / Phase 3

- [x] 工程条件 Zod Schema（`src/modules/parameter-planning/domain/contracts.ts`）
- [x] 参数录入表单（React Hook Form + Zod，12 字段 + 草稿自动保存）
- [x] 自然语言补充输入（最长 800 字符）
- [x] 参数预测与多方案结果视图（推荐 / 备选 / 风险）
- [x] 方案对比图表（雷达 / 柱状 / 敏感性）
- [x] 参数敏感性热力图
- [x] 确定性 Demo Planner 纯函数 + Vitest 35 条覆盖
- [x] PlanningRepository 接口 + In-Memory Demo 实现 + Drizzle Schema 蓝图
- [x] Desktop 三栏 / Mobile 步骤式工作台
- [x] 高风险场景自动 blocked + 补充信息提示
- [x] Timeline 6 步执行体验 + 取消 / 重置
- [x] URL 同步（`?preset=`、`?scheme=`、`?chart=`）
- [x] 状态机 Hook（`usePlanningExecution`）
- [x] Zustand 分片（`useSelectionStore` / `usePlannerUIStore`）

## Phase 3：Agent Runtime

- [x] DeepSeek Provider Adapter（OpenAI-compatible，仅服务端 `server-only`）
- [x] Agent Registry（8 个 Agent，全部声明 id/name/description/model/mode/inputSchema/outputSchema/tools/maxSteps/timeoutMs/promptVersion/requiresApproval）
- [x] Tool Registry（8 个 Tool，全部 Zod 校验；复用 Session 3 纯函数；记录耗时与状态）
- [x] Prompt Registry（集中版本化；4 条硬约束；不暴露到前端）
- [x] Workflow Engine（10 Step Spec + 状态机 + 快照重建 + 阻塞识别）
- [x] WorkflowEventBus + RunRepository（事件订阅 / 持久化 / 取消标记）
- [x] Orchestrator / Supervisor（决策 Replay vs 真实调用；emit 全套事件）
- [x] Trace Recorder + FrontendTraceSummary（安全摘要，不暴露 Prompt / Key）
- [x] Replay / Degradation（standard / complex / high-risk 三套预录制）
- [x] SSE 流式接口 `/api/agent/runs/stream` + `/api/agent/runs/[id]` + `/api/agent/runs/[id]/convert`
- [x] React Flow Workflow 视图（节点 / 边 / 状态 / 详情面板 / Mobile Bottom Sheet）
- [x] Agent 工作台 `/agents` 完整页面（Agent 池 / Tool 池 / Schema 摘要 / 最近 Run）
- [x] Planner 接入（`useAgentWorkflow` Hook + 自动 fallback 到 Session 3 Demo Planner）
- [x] 测试 Vitest 83 条（Agent Schema / Tool I/O / Workflow / Safety 阻断 / Replay 顺序 / 流恢复 / Provider 降级）
- [x] `npm run lint` / `typecheck` / `test` / `build` 全部通过

## Phase 4：知识库 / 审批 / 报告

- [ ] 知识库 + RAG 真实接入（pgvector / Elasticsearch 替换 `DEMO_KNOWLEDGE`）
- [ ] 知识引用面板（带文档 ID + 页码 + 章节 + 高亮命中片段）
- [ ] Safety Reviewer 增强（与人工审批打通）
- [ ] 人工审批节点 UI（`POST /api/agent/runs/[id]/approve` + Orchestrator `awaitHumanApproval`）
- [ ] 报告 PDF / Markdown 导出
- [ ] Run 持久化（Drizzle/PostgreSQL 替换 InMemory `RunRepository`）
- [ ] 多用户隔离与权限模型
- [ ] PresentationScriptBar 接入驾驶舱 / 方案对比页 / Workflow 页

## Phase 5：报告与会议演示

- [ ] 报告预览（在 `/reports` 接入推荐方案 + 风险 + 引用 + 人工复核位）
- [ ] 报告导出（PDF + Markdown）
- [ ] 预录制 Run 自动播放（基于 `PresentationScriptBar` + Workflow 事件流）
- [ ] 故障降级策略的演示动画（Key 缺失 → Replay 自动展示）
- [ ] 会议彩排与导出
- [ ] 图表主题缓存随 `data-theme` 失效（`invalidateChartThemeCache` 接入）
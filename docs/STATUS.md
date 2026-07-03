# 当前开发状态

更新时间：2026-07-04（Phase 5 收官 + Workflow 页面 Phase 3 可视化能力落地 — Vitest 136/136；lint / typecheck / build 全部通过）

## 已完成

### 2026-07-04 追加：Workflow Phase 3 强化

- `useWorkflowStream` Hook（`fetch + ReadableStream` SSE；`processLine` 解析四类帧）
- `applyEventsToSteps` 纯函数：事件 → 节点状态映射；事件驱动 running 节点脉冲 / blocked 节点注意力动画
- `WorkflowViewerClient` 实时流 Tab：启动演示按钮组（Standard / Complex / High-Risk × `replay=1`）+ 停止 / 重置；保留历史 Run 二级 Tab
- `review.blocked` 自动：顶部红色警告卡 + 自动 focus `review_safety` 节点 + 「演示回放模式」徽章提前显示
- 第四张 FeatureCard「节点详情面板」；PageHeader 增加 `DemoModeBadge`
- 新增测试 `apply-events-to-steps.test.ts`（5）+ `use-workflow-stream.test.ts`（7）

### Phase 1（视觉与骨架）

- Next.js 16 + React 19 + Tailwind CSS v4 项目骨架
- TypeScript Strict、ESLint、`tsc --noEmit` typecheck 脚本
- 设计 Token（深色工业科技主题 + 浅色主题）
- 公共组件库（Button、Surface、Card、Badge、Skeleton、Separator、PageHeader、SectionHeader、MetricCard、Status/Risk/DemoMode Badge、Empty/Error/Loading State、WorkspacePage、ModulePreviewCard、Progress、Textarea）
- 响应式 App Shell（Navbar + Sidebar + MobileBottomNav + Mobile Drawer）
- 主题切换（dark / light / system，SSR-safe）
- 6 个主导航路由骨架（dashboard / planner / agents / workflow / knowledge / reports / approvals），全部含占位内容
- 品牌首页 Hero（Phase 1）+ 6 能力卡
- 全局 loading / error（含恢复动作） / not-found
- Demo 种子数据：3 项目 / 8 Agent / 10 Workflow Step / 4 Knowledge Doc / 3 Report
- `.env.example` 仅含两个公开变量

### Phase 2（已落地的部分）

- 动画基础设施：`motion@12` + `CountUp` + `RevealOnScroll`，全部 SSR-safe + 兼容 `prefers-reduced-motion`
- 图表基础设施：`echarts@6` + 设计 Token 主题 + `next/dynamic` 按需加载 + `ChartSkeleton`
  - `AgentStageChart` / `RiskDistributionChart` / `TaskTrendChart`
- 演示模式：`usePresentationStore` + `PresentationShell` + `PresentationToggle` + `PresentationScriptBar`
- 驾驶舱完整化
- 品牌展示首页完整化
- Dashboard 类型与 `loadDashboardSnapshot` 集中数据源

### Phase 2 / Session 3 — 参数规划核心工作台

- `src/modules/parameter-planning/` 落地 `domain / infrastructure` 分层与纯函数 Planner
- Zod 契约
- 确定性 Demo Planner
- 三类预设场景：常规 / 复杂约束 / 高风险拦截
- Repository 接口 + In-Memory Demo 实现
- `PlannerWorkbench`：Desktop 三栏 + Mobile 步骤式
- 表单 12 字段、6 步 Timeline、三类图表
- Zustand 分片；URL 同步
- `vitest` 35/35 通过

### Phase 3 / Session 4 — Agent 架构核心

- Provider Adapter（OpenAI-compatible DeepSeek）
- Agent Runtime 模块（Orchestrator / Supervisor / Agent Registry / Workflow Engine / Tool Registry / Context Builder / Guardrails / Trace Recorder / Replay / WorkflowEventBus / SSE）
- 流式接口：`/api/agent/runs/stream` 与 `/api/agent/runs/[id]`
- Workflow 可视化（React Flow）
- Agent 工作台 `/agents`
- Planner 接入（`useAgentWorkflow` Hook）
- 测试：Vitest 83/83

### Phase 5 / Session 5 — RAG / 引用 / 人工复核 / 报告 / Demo 串联

- **知识库数据模型**
  - `knowledge_documents` / `knowledge_chunks` / `knowledge_citations`
  - 含 `sourceType` / `page` / `section` / `category` / `score` / `matchedTokens` / `usedByAgents` / `affectedConclusions`
  - In-Memory Repository 完整支持 4 类文档类型（knowledge / regulation / case / material）+ 6 类类别（explosive / water / environment / cost / risk-review / general）
- **Demo 知识资料**：8 份种子文档 + 17 个 chunk，覆盖炸药类型 / 含水环境 / 环境敏感 / 成本与施工便利性 / 风险复核原则 5 大主题。所有来源在 UI 中可识别，明确标记为教学 / 规范摘要 / 案例摘要，不伪造真实规范条款。
- **RAG 检索层**
  - 清晰接口：`Query Rewrite` / `Metadata Filter` / `Keyword Search` / `Vector Search Adapter` / `Merge` / `Rerank` / `Citation Packaging`
  - `KeywordAdapter` 始终启用（无 Embedding 也可工作）
  - `VectorAdapter` 可选（OpenAI-compatible / 自定义 embedder），未启用时 Pipeline 自动回退到关键词
  - 重排序权重可调，0 命中安全过滤
  - 检索结果必须真实存在，禁止模型编造
- **知识库页面**：8 份文档列表（含分类 / 状态 / 片段数 / 命中查询入口 / 命中片段 / 相关度 / 来源 / 页码 / 章节 / 被哪些 Agent 使用）；Demo 上传入口（不要求生产级解析）。
- **引用面板**（`CitationPanel`）：统一展示文档名 / 章节页码 / 命中片段 / 检索得分 / 使用 Agent / 影响结论；不允许仅显示「来自知识库」；已接入 Planner / Scheme 详情 / Workflow Step / Report 预览。
- **Safety Reviewer**
  - `runSafetyReview` 确定性检查（缺失参数 / 规则冲突 / 模型 vs 规则 / 缺少引用 / 高风险字段 / 环境敏感 / 数据时效）
  - 生成「人工重点确认清单」 + 高风险阻断
  - 规则全部代码 / 配置化，模型自由判断被压制
- **Human-in-the-loop**（`HumanApprovalService` + `/api/agent/approvals` + `/approvals`）
  - `waiting_for_approval` 状态
  - 查看待确认字段、填写复核意见、accept / modify-accept / reject / return
  - 保存 Reviewer / 时间 / 修改内容；预留真实认证扩展位
  - `RequestHumanApprovalTool` 自动注册待办；`RunSafetyReviewTool` 联动登记
- **报告中心**
  - In-Memory `ReportRepository`
  - `buildReport` 从单一 Planning Run + Citations + Approval Snapshot 组装报告（封面 / 场景摘要 / 原始输入 / 标准化参数 / 参数预测 / 推荐 / 备选 / 风险方案 / 评分 / 风险清单 / 知识引用 / Agent Workflow 摘要 / 人工复核意见 / 安全责任边界）
  - `/api/reports`（GET 列表 / 单报告 / MD / JSON / HTML；POST 生成）
  - `/reports` 页面含列表 / 状态 / 关联项目 / 生成时间 / 人工复核状态 / 预览 / 导出
- **导出**：HTML（打印 / 保存为 PDF 优化版，含 `@media print` 分页）+ Markdown + JSON；不含高风险服务器端浏览器依赖
- **演示模式**：完整可控辅助（快速进入核心路径 / 重置 / 切换预设 / 真实 / 回放模式 / 全屏导航 / 模型失败不打断）
- **知识库页面录入 → 检索 → 引用 → 报告** 全链路串联
- **测试**：Vitest 124 / 124（覆盖 RAG / Citation / Safety / Approval / Report / Knowledge Repository）；`tsc --noEmit` / `eslint` 0 errors；`next build` 成功；导航无 404。

## 正在进行

- 长期扩展：Drizzle / PostgreSQL 接入、用户认证、E2E 浏览器自动化

## 当前可运行页面

- `/` 完整 Showcase Landing Page
- `/dashboard` 完整智能驾驶舱（含演示模式入口）
- `/planner` **完整 Demo 工作台**（Agent Workflow 可选启用 + 自动降级 Demo Replay + 引用面板）
- `/agents` **Agent 工作台（完整版）**
- `/workflow` **Workflow 执行视图（React Flow）**（预录制 Run + 实时流 Tab；启动演示按钮组驱动 SSE；事件流驱动节点脉冲 / blocked 注意力动画；review.blocked 自动警告卡 + 自动 focus 节点）
- `/knowledge` **完整知识库页面**（文档列表 + 检索测试 + Citation Panel）
- `/approvals` **人工复核中心**（accept / modify / reject / return + 评论）
- `/reports` **报告中心**（列表 + 预览 + 打印 / PDF / MD / JSON 导出）
- `/api/agent/runs` / `/api/agent/runs/stream` / `/api/agent/runs/[id]` / `/api/agent/runs/[id]/convert`
- `/api/agent/approvals`（GET 列表 / 单 Run；POST 状态变更）
- `/api/reports`（GET 列表 / 单报告 / MD / JSON / HTML；POST 生成）
- `/<unknown>` 全局 404

## 当前技术状态

- 包管理器：npm
- 数据库：内存 Repository（演进蓝图 Drizzle/PostgreSQL/pgvector 已就位，可平滑切换）
- DeepSeek：Provider Adapter + `server-only`；默认降级 Demo Replay；缺 Key 自动 Replay
- Agent Runtime：完整 Orchestrator / Agent / Tool / Workflow / Trace / Replay / Event Bus
- RAG：Query Rewrite + Metadata Filter + Keyword Adapter + Vector Adapter（可选）+ Merge + Rerank + Citation Packaging
- 知识库：8 文档 + 17 chunk
- Safety / Approval / Report：完整模块
- 演示基础设施：动效 / 图表 / Workflow / 引用 / 报告
- 测试：Vitest 136 条（Phase 5 + Workflow Phase 3 强化）

## 已知问题

- 当前 Repository 全部为 In-Memory；切换 PostgreSQL/pgvector 时按 `src/db/schema` 蓝图直接迁移
- `PresentationScriptBar` 已实现；当前默认未自动播放，避免「假演示」
- 移动端底部导航默认隐藏 `Workflow` 一项（会议演示侧建议通过侧栏打开）
- 浅色主题切换时图表颜色需刷新页面（缓存在 `chart-theme.ts`）
- 2026-07-04：`SidebarProvider` 之前以 `localStorage` 作为 `useState` 初值，导致 SSR 与 client 首屏渲染 `collapsed` 不一致，连带 `Navbar` 的 `aria-label` / `aria-pressed` 与 `PanelLeft` / `PanelLeftClose` 图标触发 React Hydration 报错。修复方式：把读取 `localStorage` 的逻辑从 `useState` 初值下沉到 `useEffect`，SSR/Client 初值统一为 `false`，hydration 完成后再同步用户偏好。
- 2026-07-04：Workflow 页面新增 SSE Hook 与实时流 Tab；事件驱动的 running / blocked 节点动画已落地，运行中脉冲与注意力动画可通过 DevTools 的「Emulate CSS prefers-reduced-motion: reduce」验证降级行为。

## 下一建议任务

- Drizzle/PostgreSQL 持久化 + pgvector 真实向量检索
- 真实用户认证 + 权限模型
- 浏览器自动化 E2E（Playwright）
- 服务端 PDF 渲染可选升级（仅在环境稳定时）

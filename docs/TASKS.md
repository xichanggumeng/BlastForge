# 开发任务

## Phase 1：视觉与骨架

- [x] 建立 Design Token（CSS Variables + Tailwind v4 @theme）
- [x] 建立应用 Shell（Navbar + Sidebar + MobileBottomNav）
- [x] 实现桌面侧边栏（含折叠态）
- [x] 实现移动端导航（Drawer + BottomNav）
- [x] 实现主题切换（dark / light / system）
- [x] 公共组件库
- [x] 6 个主路由骨架 + 全局 loading / error / not-found
- [x] Demo 基础数据（类型与种子常量）

## Phase 2：参数规划 + 展示基础设施

- [x] 引入 Motion 与 ECharts（按需加载）
- [x] 设计 Token 化图表主题 + 主题切换适配
- [x] 统一动画钩子
- [x] CountUp 数字递增组件
- [x] RevealOnScroll 滚动进入组件
- [x] 品牌首页完整化（Hero / Metrics / Flow / Capabilities / AgentPool / Safety / Architecture / CTA）
- [x] Agent 协作网络 SVG（9 节点 + 6 节点紧凑版）
- [x] 大屏展示模式
- [x] 浅色 / 深色主题完整支持

### 驾驶舱

- [x] Dashboard 类型与 `loadDashboardSnapshot` 集中数据源
- [x] 当前 Demo 项目卡
- [x] Agent 池活跃状态面板
- [x] 最近 Run 时间线
- [x] 待人工复核清单
- [x] 风险提醒列表
- [x] 知识引用网格
- [x] 最近报告列表
- [x] 三张图表
- [x] PageHeader 增加演示模式入口

### 参数规划

- [x] 工程条件 Zod Schema
- [x] 参数录入表单（React Hook Form + Zod）
- [x] 自然语言补充输入
- [x] 参数预测与多方案结果视图
- [x] 方案对比图表（雷达 / 柱状 / 敏感性）
- [x] 参数敏感性热力图
- [x] 确定性 Demo Planner 纯函数 + Vitest 35 条覆盖
- [x] PlanningRepository 接口 + In-Memory Demo 实现
- [x] Desktop 三栏 / Mobile 步骤式工作台
- [x] 高风险场景自动 blocked + 补充信息提示
- [x] Timeline 6 步执行体验
- [x] URL 同步
- [x] 状态机 Hook
- [x] Zustand 分片

## Phase 3：Agent Runtime

- [x] DeepSeek Provider Adapter（OpenAI-compatible，server-only）
- [x] Agent Registry（8 个 Agent）
- [x] Tool Registry（9 个 Tool：本次新增 `run_safety_review`）
- [x] Prompt Registry
- [x] Workflow Engine（10 Step Spec）
- [x] WorkflowEventBus + RunRepository
- [x] Orchestrator / Supervisor
- [x] Trace Recorder + FrontendTraceSummary
- [x] Replay / Degradation（3 套预录制）
- [x] SSE 流式接口
- [x] React Flow Workflow 视图
- [x] Agent 工作台 `/agents`
- [x] Planner 接入
- [x] 测试 Vitest

## Phase 5：知识库 / 引用 / 审批 / 报告 / Demo 串联

### 知识库与 RAG

- [x] 知识库数据模型（`KnowledgeDocument` / `KnowledgeChunk` / `KnowledgeCitation`）
- [x] 知识种子数据（8 文档 / 17 chunk，5 大主题全覆盖）
- [x] Query Rewrite + Metadata Filter + Keyword Adapter
- [x] Vector Adapter（可选，未启用时自动回退关键词）
- [x] Merge + Rerank（权重重排 + 0 命中安全过滤）
- [x] Citation Packaging（`usedByAgents` / `affectedConclusions` / `matchedTokens`）
- [x] In-Memory KnowledgeRepository（无 DB 启动）
- [x] 知识库页面：文档列表 / 分类 / 状态 / 片段数 / 检索测试 / 命中片段 / 相关度 / 来源 / 页码章节 / 引用 Agent
- [x] Demo 上传入口（不要求生产级解析）

### 引用面板

- [x] CitationPanel 组件
- [x] 接入 Planner（`SchemeDetailPanel`）
- [x] 接入 Workflow Step（`WorkflowFlow`）
- [x] 接入 Report 预览
- [x] 禁止仅显示「来自知识库」（强制显示文档 / 章节 / 得分 / Agent / 结论）
- [x] 点击引用展开详情

### Safety Reviewer

- [x] 缺失参数检查
- [x] 规则冲突检查
- [x] 模型结果 vs 确定性规则
- [x] 缺少引用检查
- [x] 高风险字段标记（`environmentSensitivity=high` / `urban-excavation` / `underground-cavern` / `tunnel`）
- [x] 环境敏感检查
- [x] 人工重点确认清单生成（`manualConfirmation`）
- [x] 高风险时阻断（`blocked=true`）
- [x] 规则全部代码 / 配置化
- [x] `runSafetyReview` 与 `RunSafetyReviewTool` 联动人工审批

### Human-in-the-loop

- [x] `HumanApprovalService`（register / list / transition / clear）
- [x] `waiting_for_approval` 状态机
- [x] `/approvals` 页面（accept / modify / reject / return + 评论）
- [x] `/api/agent/approvals` API
- [x] ReviewerIdentity / 时间 / 修改内容持久化
- [x] `RequestHumanApprovalTool` 自动登记待办
- [x] Agent 不得自动通过该节点（强制人工确认）

### 报告中心

- [x] `Report` 契约
- [x] `buildReport`（cover / summary / input / normalized / schemes / risks / citations / workflow summary / approval / responsibility）
- [x] `ReportRepository` In-Memory
- [x] `/reports` 页面（列表 / 状态 / 关联 Run / 时间 / 复核状态 / 预览）
- [x] `/api/reports` API（GET 列表 / 单报告 / MD / JSON / HTML；POST 生成）
- [x] Planner 内「生成报告」按钮

### 导出

- [x] Markdown 导出（章节 / 引用 / 责任边界）
- [x] HTML 导出（打印 / PDF 优化版）
- [x] JSON 导出
- [x] 浏览器原生 Print-to-PDF
- [x] 不引入高风险 / 重量级服务端浏览器依赖

### 演示模式

- [x] 快速进入核心演示路径（驾驶舱 / Planner / Workflow / Knowledge / Reports / Approvals）
- [x] 重置 Demo（清空 In-Memory Repository）
- [x] 切换预设场景（常规 / 复杂 / 高风险）
- [x] 真实模式（配 Key 时启用）/ 回放模式（无 Key / 演示）
- [x] 全屏下导航清晰（侧栏折叠 / Drawer）
- [x] 模型失败不打断（Provider Adapter 失败 → 自动 Replay）

### 视觉与可访问性

- [x] 间距 / 对齐 / 字号 / 对比度（深色主题商业展示质量）
- [x] Empty / Loading / Error 状态覆盖所有页面
- [x] Reduced Motion 兼容
- [x] 键盘焦点 / Dialog / 表单 Label / Icon Button aria-label
- [x] Mobile 步骤式工作台 + 溢出处理

### 性能

- [x] ECharts / React Flow / Motion 动态加载
- [x] 长列表分页 + Skeleton
- [x] Workflow 事件流节流渲染
- [x] 取消请求支持（SSE + abortController）

### 测试

- [x] 单元测试（RAG / Citation / Safety / Approval / Report / Knowledge Repo）
- [x] Workflow 集成测试（Orchestrator / Replay）
- [x] 引用真实性测试
- [x] 人工审批测试（transition / 历史）
- [x] 报告数据一致性测试
- [x] Vitest 124 / 124 通过
- [x] `npm run lint` / `typecheck` / `test` / `build` 全部通过

### 文档

- [x] README 更新（技术栈 / 安装 / 环境变量 / 数据库可选 / Demo Replay / DeepSeek / 测试 / 演示方式 / 安全边界）
- [x] `docs/demo-script/00-demo-overview.md`
- [x] `docs/demo-script/01-main-scenario.md`
- [x] `docs/demo-script/02-risk-block-scenario.md`
- [x] `docs/demo-script/03-agent-architecture.md`
- [x] `docs/demo-script/04-fallback-plan.md`
- [x] `docs/handoffs/session-5.md`

### 清理

- [x] 删除无用的 console.log 调试
- [x] 检查 TODO
- [x] 检查敏感信息（仅服务端读取 Key）
- [x] 检查 Logo.jpg / Icon.ico 使用
- [x] 检查导航无 404

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

- [ ] 工程条件 Zod Schema
- [ ] 参数录入表单（React Hook Form + Zod）
- [ ] 自然语言补充输入
- [ ] 参数预测与多方案结果视图
- [ ] 方案对比图表（雷达 / 柱状 / 敏感性）
- [ ] 参数敏感性热力图

## Phase 3：Agent Runtime

- [ ] DeepSeek Provider Adapter（仅服务端）
- [ ] Agent Registry
- [ ] Tool Registry
- [ ] Workflow Engine
- [ ] Trace Recorder
- [ ] React Flow Workflow 视图
- [ ] 演示脚本自动播放（基于 Session 2 `PresentationScriptBar`）

## Phase 4：RAG 与复核

- [ ] 知识库（pgvector）
- [ ] 知识引用面板
- [ ] Safety Reviewer
- [ ] 人工确认节点

## Phase 5：报告与会议演示

- [ ] 报告预览
- [ ] 报告导出（PDF / Markdown）
- [ ] 预录制 Run 回放
- [ ] 故障降级策略
- [ ] 演示脚本与会议彩排
- [ ] 图表主题缓存随 `data-theme` 失效（`invalidateChartThemeCache` 接入）
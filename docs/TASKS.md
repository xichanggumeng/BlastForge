# 开发任务

## Phase 1：视觉与骨架

- [x] 建立 Design Token（CSS Variables + Tailwind v4 @theme）
- [x] 建立应用 Shell（Navbar + Sidebar + MobileBottomNav）
- [x] 实现桌面侧边栏（含折叠态）
- [x] 实现移动端导航（Drawer + BottomNav）
- [x] 实现主题切换（dark / light / system）
- [x] 公共组件库（PageHeader / SectionHeader / Surface / MetricCard / Badge 系列 / Empty / Error / Loading / Skeleton）
- [x] 6 个主路由骨架 + 全局 loading / error / not-found
- [x] Demo 基础数据（类型与种子常量）

> Phase 1 不引入 Motion 动画库与图表库，待 Phase 2/3 引入后补充动画与图表基础设施。

## Phase 2：参数规划

- [ ] 工程条件 Zod Schema
- [ ] 参数录入表单（React Hook Form + Zod）
- [ ] 自然语言补充输入
- [ ] 参数预测与多方案结果视图
- [ ] 方案对比图表（ECharts）
- [ ] 参数敏感性热力图
- [ ] 引入 Motion 强化工作台叙事动画
- [ ] 引入 Zod 校验 + 类型化 DTO
- [ ] 引入 Zustand（仅 UI 工作区状态）

## Phase 3：Agent Runtime

- [ ] DeepSeek Provider Adapter（仅服务端）
- [ ] Agent Registry
- [ ] Tool Registry
- [ ] Workflow Engine
- [ ] Trace Recorder
- [ ] React Flow Workflow 视图

## Phase 4：RAG 与复核

- [ ] 知识库（pgvector）
- [ ] 知识引用面板
- [ ] Safety Reviewer
- [ ] 人工确认节点

## Phase 5：报告与会议演示

- [ ] 报告预览
- [ ] 报告导出（PDF / Markdown）
- [ ] 演示模式（全屏、预设场景、预录制 Run）
- [ ] 故障降级策略
- [ ] 演示脚本与会议彩排
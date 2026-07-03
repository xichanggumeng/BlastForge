# Demo 总览（00）

## 演示目标

在 8–12 分钟内，向商业会议演示者展示：

1. **AI-Native 工业参数规划**：爆破方案从「手工经验」到「多 Agent 协作 + RAG 引用 + 人工复核」的完整流程。
2. **可商业交付的 Demo 质量**：深色工业主题 / 真实知识库 / 真实 Agent Workflow / 真实 Safety Reviewer / 真实 HITL / 真实报告。
3. **可控的展示辅助**：三种预设场景（常规 / 复杂 / 高风险），可在 5 秒内切换；模型失败时自动降级到 Replay，不打断演示。
4. **演示与生产边界**：内置 `DEMO_REPLAY_ENABLED`，Key 缺失或模型超时自动回放；所有引用均可在 UI 中展开并回溯到知识库原文。

## 路由一览（按演示顺序）

| 步骤 | 路径 | 关键看点 |
| ---- | ---- | -------- |
| 0    | `/`  | 品牌首页：Hero + 能力分布 + Agent 协作网络 |
| 1    | `/dashboard` | 智能驾驶舱：当前项目 / Run 时间线 / Agent 池 / 风险 / 引用 |
| 2    | `/planner` | 参数规划：场景选择（预设切换） → 表单 → 方案对比 |
| 3    | `/workflow` | Workflow 可视化：10 节点 + 状态 + 引用面板 + Trace |
| 4    | `/knowledge` | 知识库：文档 / 检索测试 / 命中片段 / 文档详情 |
| 5    | `/approvals` | 人工复核：高风险阻断 + accept / modify / reject |
| 6    | `/reports` | 报告中心：列表 / 预览 / 打印 PDF / Markdown / JSON |

## 三个预设场景

| preset | 环境敏感 | 工程类型 | 含水 | 主要演示点 |
| ------ | -------- | -------- | ---- | -------- |
| standard | low | open-pit-bench | dry | 6 节点全流程、推荐方案 + 备选 |
| complex | medium | underground-cavern | wet | 装药结构调整、敏感性热力图、引用 |
| high-risk | high | urban-excavation | damp | Safety Reviewer 触发阻断、人工复核签字 |

## 完整脚本

按本目录下其他文件顺序执行，每个对应一个演示步骤：

- `01-main-scenario.md` — 标准场景 6 步演示
- `02-risk-block-scenario.md` — 高风险场景 8 步演示（含审批与导出）
- `03-agent-architecture.md` — Agent 架构 / Workflow / 引用讲解
- `04-fallback-plan.md` — 故障降级 / 回放模式 / 演示保障

## 会议彩排建议

1. 提前 5 分钟打开 `/dashboard`，确认 Demo Replay 模式（缺 Key 时自动启用）。
2. 提前准备三套预设场景的浏览器 Tab：复制 `/planner?preset=standard`、`?preset=complex`、`?preset=high-risk`。
3. 演示过程中如遇模型卡顿，按 `Esc` 取消当前 Run，Orchestrator 自动降级 Replay。
4. 报告会下载建议选「HTML 打印 → 浏览器 → 保存为 PDF」三步走，避免依赖服务端渲染。

## 安全与责任边界（必读）

- 演示中所有「推荐方案」均为教学与方案评估辅助，最终施工必须由具备资质人员复核。
- 知识库内的文档均明确标记 `sourceType` / `category`，引用展开可见来源。
- 当环境敏感 = `high` 或工程类型属于「地下 / 隧道 / 城镇」时，Safety Reviewer 自动阻断；未走完人工审批前 Agent 不得继续。
- `DEEPSEEK_API_KEY` 仅服务端可读，不暴露到前端 Bundle。

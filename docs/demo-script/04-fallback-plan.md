# 降级与回放方案（04）

预计 1 分钟，仅展示左上角演示模式徽章。

## 1. 三档控制策略

### 真实模式（推荐有 Key 时）

- 环境变量：`DEEPSEEK_API_KEY=<your-key>`。
- Orchestrator 优先调用 Provider Adapter；超时由 `AI_REQUEST_TIMEOUT_MS` 控制（默认 15 秒）。
- 失败原因会写入 `providerFailure` Trace，但状态条不变红。

### 混合模式（默认 + 缺 Key 自动降级）

- 未配置 Key → Provider Adapter 抛错 → Orchestrator 自动切到 `planDemo` Replay。
- `/workflow` 节点详情展示「回放 mode」标识。
- UX 不暴露「失败」，会议演示不会中断。

### 强制 Replay（演示彩排 / 离线环境）

- 环境变量：`DEMO_REPLAY_ENABLED=1`。
- 即使有 Key，也走 3 套预录制 Run（standard / complex / high-risk）。
- 适合在出差路上 / 网络隔离环境彩排。

## 2. 一键重置 Demo

- 演示模式开关旁的「重置 Demo」按钮会清空 `InMemoryRunRepository` / `KnowledgeRepository` / `ReportRepository` / `HumanApprovalService`。
- 触发「重置」后页面回到默认 Dashboard，所有 Run 列表清空。
- Knowledge 与 Report 列表保留 Demo 预置内容。

## 3. 故障排查清单

| 现象 | 排查点 |
| ---- | ---- |
| Planner 一直 Loading | 检查 `DEMO_REPLAY_ENABLED`；强制 `1` 后重试 |
| 引用面板空白 | 检索 query 含生僻字 → 切换为中文自然语言 |
| `/api/agent/runs/stream` 断开 | 浏览器 SSE 缓冲（`EventSource` 默认自动重连） |
| 报告导出 PDF 空白 | 使用浏览器原生「打印 → 另存为 PDF」 |
| 模型卡在某节点 | `Esc` 取消当前 Run，重试一次 |

## 4. 演示前检查表

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` 全部通过
- [ ] `.env` 无 `DEEPSEEK_API_KEY` 时默认走 Replay（演示稳定性最高）
- [ ] 三个预设 URL 准备好书签：`/planner?preset=standard|complex|high-risk`
- [ ] 浏览器字体 ≥ 14pt；屏幕缩放 100%
- [ ] Reduced Motion 在系统设置开启，动画自动降级
- [ ] `/dashboard` 最近一次 Run 时间戳为最近 5 分钟

## 5. 责任边界再确认

- Demo 不向外部网络开放任何施工指令通道。
- 不通过 DeepSeek 调用执行任何具体施工操作。
- 所有方案结果都需要人工复核签字后才能进入下一步。
- 知识库内容明示「教学 / 规范摘要 / 案例摘要」标签，禁止冒充正式规范。

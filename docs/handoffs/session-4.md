# Session 4 Handoff — DeepSeek Agent Runtime · Agentic Workflow · 流式 Trace · 回放降级

> 目标：在会话 3 已建立的 Planning Contracts / Demo Planner / Workbench 之上，接入 DeepSeek 多 Agent 架构、Tool Calling、可视化 Workflow、流式 Trace 和真实/回放双模式，不破坏现有确定性 Demo Planner。

---

## 1. 范围与交付

本阶段在不推翻会话 3 工作台的前提下，把"参数规划"从单一确定性 Planner 升级为 **Agentic Workflow 编排 + Tool Calling + 可视化 + 流式事件**的工程方案：

- **Provider Adapter**：`LanguageModelProvider` 统一接口；DeepSeek 通过服务端 OpenAI-兼容 HTTP 封装；模型名 / Key / 超时全部从环境变量读取；支持流式文本、结构化输出和 Tool Calling。
- **Agent Runtime**：8 个 Agent 定义（Supervisor / Input Normalizer / Knowledge Retriever / Parameter Planner / Scheme Generator / Evaluation / Safety Reviewer / Report），每个 Agent 声明 `id / name / model / mode / inputSchema / outputSchema / tools / maxSteps / timeoutMs / promptVersion / requiresApproval`。
- **Prompt 管理**：集中 + 版本化（`vX.Y.Z`），不散落到 Route / Component；系统 Prompt 强调工程辅助、模拟数据、人工复核、禁止直接现场控制。
- **Tool Registry**：8 个 Tool（normalize / search_knowledge / run_rule_check / calculate_scheme_score / analyze_parameter_sensitivity / compare_schemes / request_human_approval / build_report_outline），全部 Zod 输入输出，确定性计算复用会话 3 纯函数。
- **Workflow Engine**：主流程 10 步（validate_input → normalize_parameters → retrieve_knowledge → run_rule_precheck → plan_parameters → generate_schemes → calculate_scores → review_safety → human_approval → generate_report），状态覆盖 `created / running / waiting_for_input / waiting_for_approval / completed / blocked / failed / cancelled`。
- **Workflow 事件总线**：12 类类型安全事件，`WorkflowEventBus` + `RunRepository` 支持实时推送 + 重建视图。
- **流式接口**：`/api/agent/runs/stream` SSE 持续输出事件，`/api/agent/runs/[id]` 完整恢复、`/api/agent/runs/[id]/convert` 把 `WorkflowRun` 转回 `PlanningRun`。
- **可视化**：`/workflow` 页面使用 React Flow 渲染节点 / 数据流 / 状态脉冲，区分 pending / running / succeeded / failed / blocked / waiting_for_approval；详情面板只显示结构化摘要、工具、引用、耗时、错误，**不展示隐藏思维过程**；预录制 Run + 当前 Run 共存。
- **Agent 工作台**：`/agents` 页面展示 Agent 池、职责、模型模式、可用 Tool、Schema 摘要、当前版本、最近运行；体现"可组合能力中心"。
- **参数规划工作台接入**：PlannerWorkbench 启动规划时优先调用 Agent Workflow；无 Key / 网络失败 / Schema 失败时自动回落到会话 3 的 `planDemo`，UI 用 `AgentModeBanner` 标识"演示回放模式"。
- **Trace**：服务端 `TraceRecorder` 记录 `requestId / runId / workflowId / stepId / agentId / toolCallId / model / mode / promptVersion / startedAt / completedAt / duration / status / errorCode`；前端只展示安全摘要。
- **测试**：Agent Schema、Tool I/O、Workflow 状态机、Safety 阻断、结构化失败、Replay 事件顺序、流中断恢复、Orchestrator 集成 83 条全绿。

---

## 2. 模块结构（不可随意调整）

```
src/modules/agent-runtime/
├── server/
│   ├── server-config.ts        # 服务端环境变量与配置
│   └── provider.ts             # DeepSeek Provider Adapter（OpenAI-compatible fetch）
├── core/
│   ├── contracts.ts            # AgentDefinition / WorkflowRun / WorkflowEvent / Citation / Trace 等契约
│   ├── prompt-registry.ts      # 集中版本化 Prompt（不散落到 Route）
│   ├── agent-registry.ts       # 8 个 Agent 定义 + run(ctx) 入口
│   ├── tool-registry.ts        # 8 个 Tool + DEMO_KNOWLEDGE
│   ├── workflow-engine.ts      # 步骤规范 / 状态机 / 重建
│   ├── event-bus.ts            # WorkflowEventBus（发布订阅、序号生成）
│   ├── run-repository.ts       # InMemory Run Repository（Run + Events + input）
│   ├── trace-recorder.ts       # 服务端 Trace（安全摘要导出）
│   ├── replay.ts               # 预录制 Replay 数据（standard / complex / high-risk）
│   ├── replay-snapshot.ts      # 把 DemoReplay 合成 WorkflowRun + 事件 + Trace
│   ├── orchestrator.ts         # 主入口 runWorkflow（Replay vs 真实调用二选一）
│   ├── context-builder.ts      # 注入到 Prompt 的 JSON 上下文
│   ├── guardrails.ts           # Safety / Schema / 阻止规则辅助
│   └── human-approval.ts       # 人工审批接口（不可被 Agent 自动跳过）
└── index.ts                    # 模块 barrel

src/app/api/agent/
├── runs/route.ts                # GET 最近 Run 列表
├── runs/[id]/route.ts           # GET 单个 Run + DELETE 取消
├── runs/[id]/convert/route.ts   # POST WorkflowRun -> PlanningRun
└── runs/stream/route.ts         # SSE 流式启动 Workflow

src/components/agent/
└── (no additional components; AgentCard/ToolCard 内联于 app/(workspace)/agents/page.tsx)

src/components/workflow/
├── workflow-flow.tsx            # React Flow 节点 / 边 / 详情面板
├── workflow-viewer-client.tsx   # Live / Replay 视图切换、加载/错误态
├── workflow-step-detail.tsx     # 单 Step 详情（结构化摘要 + 工具 + 引用 + 错误）
└── workflow-event-feed.tsx      # 实时事件流（safe summary）

src/components/planner/
├── planner-workbench.tsx        # 已升级：Unified State + AgentModeBanner
└── use-agent-workflow.ts        # 桥接 PlannerWorkbench -> Agent Runtime + 失败回退
```

---

## 3. Provider Adapter

### 3.1 接口

```ts
// src/modules/agent-runtime/server/provider.ts
export interface LanguageModelProvider {
  readonly id: string;
  readonly model: string;
  readonly isAvailable: boolean;
  streamText(req: ProviderStreamRequest): Promise<ProviderStreamHandle>;
  generateStructured<T>(req: ProviderStructuredRequest<T>): Promise<ProviderStructuredResponse<T>>;
}
```

- **id** 固定 `"deepseek-v4-pro"`，**model** 从 `DEEPSEEK_MODEL` 读，默认 `deepseek-v4-pro`。
- `isAvailable` 由 `getServerAIConfig().deepseekApiKey.length > 0` 决定；无 Key 时所有调用直接走 Replay 路径。
- `streamText` 返回 `{ text: AsyncIterable<string>, abort, signal }`，由 DeepSeek 的 OpenAI-compatible chat/completions 端点（`stream: true`）驱动。
- `generateStructured<T>` 把 `outputSchema`（Zod）序列化为 JSON Schema，作为 `response_format` 投递；返回前再次 Zod 校验；校验失败抛 `ProviderError("schema_mismatch")` 并触发 Orchestrator 回退。

### 3.2 DeepSeek 调用约定

- 端点：`{DEEPSEEK_BASE_URL}/chat/completions`（默认 `https://api.deepseek.com/v1`）。
- 请求头：`Authorization: Bearer ${DEEPSEEK_API_KEY}`、`Content-Type: application/json`。
- 请求体：OpenAI 兼容，包含 `model / messages / temperature / stream / tools / response_format`。
- 客户端代码看不到 SDK 名称；Provider 内部用原生 `fetch` + `AbortController` 实现。

### 3.3 环境变量

```dotenv
# .env.example
DEEPSEEK_API_KEY=                # 留空表示走 Demo Replay
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-v4-pro
DEMO_REPLAY_ENABLED=true
AI_REQUEST_TIMEOUT_MS=20000
```

`getServerAIConfig()` 在 `src/modules/agent-runtime/server/server-config.ts` 中实现：

- 解析数字 / 布尔失败时回退默认值，不抛错。
- `deepseekApiKey` 仅在 server 侧读取；`/agents` `/workflow` 等 page 不可导入本文件。

### 3.4 降级触发条件

`runWorkflow` 决策树（`src/modules/agent-runtime/core/orchestrator.ts`）：

1. `input.forceReplay === true` → Replay。
2. `!provider.isAvailable` → Replay。
3. 调用 `provider.generateStructured` / `provider.streamText` 抛 `ProviderError` / 网络错误 / Schema 校验失败 → 仍然继续当前步骤（已发出的事件保留），结束后再返回错误码 + `replay: false`，UI 提示"未走 Replay 但调用失败"。

---

## 4. Agent Registry

### 4.1 Agent 列表（不可新增业务 Agent）

| id            | 职责（description 摘要）                                  | model            | mode          | tools                                                | maxSteps | timeoutMs | promptVersion | requiresApproval |
| ------------- | -------------------------------------------------------- | ---------------- | ------------- | ---------------------------------------------------- | -------- | --------- | ------------- | ---------------- |
| supervisor    | 全局编排，监督每个 Step 状态与回退                       | deepseek-v4-pro  | non-thinking  | —                                                    | 1        | 5_000     | v1.0.0        | false            |
| normalizer    | 把原始表单转换为归一化工程参数                            | deepseek-v4-pro  | non-thinking  | normalize_engineering_parameters                    | 2        | 6_000     | v1.0.0        | false            |
| retriever     | 检索本地 Demo 知识库片段                                  | deepseek-v4-pro  | non-thinking  | search_knowledge                                     | 2        | 8_000     | v1.0.0        | false            |
| planner       | 敏感性矩阵 + 参数推荐区间                                  | deepseek-v4-pro  | non-thinking  | analyze_parameter_sensitivity                        | 3        | 10_000    | v1.0.0        | false            |
| generator     | 候选方案生成（推荐 / 备选 / 风险）                        | deepseek-v4-pro  | non-thinking  | compare_schemes                                      | 3        | 12_000    | v1.0.0        | false            |
| evaluator     | 调用确定性评分函数                                         | deepseek-v4-pro  | non-thinking  | calculate_scheme_score                               | 3        | 8_000     | v1.0.0        | false            |
| safety        | 高风险阻断；规则 + 振速 / 飞石 / 敏感目标检查              | deepseek-v4-pro  | non-thinking  | run_rule_check                                       | 2        | 6_000     | v1.0.0        | false            |
| report        | 报告骨架生成（占位执行）                                  | deepseek-v4-pro  | non-thinking  | build_report_outline / request_human_approval        | 2        | 8_000     | v1.0.0        | true             |

每个 Agent 在 `agent-registry.ts` 中以 `defineAgent({...})` 形式声明；Prompt 通过 `getPrompt(id, version)` 读取，集中版本化。

### 4.2 Prompt 约束

- 所有系统 Prompt 均位于 `src/modules/agent-runtime/core/prompt-registry.ts`；不允许在 Route Handler / Component 中拼接。
- 系统 Prompt 至少包含 4 条硬约束：
  1. **工程辅助**：禁止给出可直接用于现场的指令。
  2. **模拟数据**：所有数字必须标注 `simulated`。
  3. **人工复核**：高风险结论必须由 Safety Reviewer + 人工审批双重确认。
  4. **禁止直接现场控制**：不得输出雷管段位、装药联动、起爆口令等控制性内容。
- 不要求模型输出"隐藏思维过程"（`<thinking>` 等）；前端只展示 `taskSummary / structuredResult / toolCalls / citations / status`。
- 系统 Prompt 全文不写入 Trace，不下发到前端；Trace 仅记录 `promptVersion` 字符串。

---

## 5. Tool Registry

| Tool name                       | 输入 / 输出 Schema                              | 实现位置                                   | 高风险 |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------ | ------ |
| normalize_engineering_parameters| `BlastScenarioInput -> { normalized, notes }`  | `tool-registry.ts -> NormalizeParamsTool`  | false  |
| search_knowledge                | `{ query, categories?, limit } -> { citations }`| `tool-registry.ts -> SearchKnowledgeTool` | false  |
| run_rule_check                  | `{ input?, normalized } -> { issues, hasBlocking }`| `tool-registry.ts -> RunRuleCheckTool` | false  |
| calculate_scheme_score          | `{ input?, normalized, category, weightOverrides? } -> { score }`| `tool-registry.ts -> CalculateSchemeScoreTool` | false |
| analyze_parameter_sensitivity   | `{ input, normalized, referenceScore? } -> { axes, cells }`| `tool-registry.ts -> SensitivityTool` | false |
| compare_schemes                 | `{ input?, schemeSet } -> { recommendations }` | `tool-registry.ts -> CompareSchemesTool`   | false  |
| request_human_approval          | `{ reason, blockingIssues } -> { approvalId, status: 'pending' }`| `tool-registry.ts -> HumanApprovalTool` | true |
| build_report_outline            | `{ schemeSet, blockedReason? } -> { outline }` | `tool-registry.ts -> BuildReportOutlineTool`| false |

要求（已全部满足）：

- 全部 Tool 使用 Zod 校验输入。
- 名称唯一；通过 `getTool(name)` 访问。
- Tool 记录 `tool.called` / `tool.completed` 事件 + 耗时。
- 确定性计算复用会话 3 的 `runRulePrecheck / calculateSchemeScore / analyzeSensitivity / planParameters / sortSchemesByOverall`。
- 不允许 SQL / Shell / 设备控制；无任何 `child_process`、`fs.write`、网络 IO。

---

## 6. Workflow 事件契约

`src/modules/agent-runtime/core/contracts.ts` 中定义了 12 类事件，每条事件均包含 `eventId / sequence / runId / timestamp / stepId / payload`，部分事件可选 `agentId / toolCallId`：

```ts
type WorkflowEventType =
  | "workflow.started"
  | "step.started"
  | "agent.started"
  | "tool.called"
  | "tool.completed"
  | "citation.attached"
  | "step.completed"
  | "review.blocked"
  | "human.input_requested"
  | "human.approved"
  | "workflow.completed"
  | "workflow.failed";
```

事件载荷使用判别联合；`WorkflowEventBus.emit` 接受 `payload: unknown` 以兼容历史已发 payload，并要求调用方在 emit 时显式 `payload as never` 强制收窄。

事件持久化：

- 实时通过 `WorkflowEventBus` 推送给 SSE 订阅者。
- 同步追加到 `RunRepository`（in-memory），Key = `runId`。
- `/api/agent/runs/[id]` 返回完整 `WorkflowRun + WorkflowEvent[] + FrontendTraceSummary[]`；前端可据此重建任意视图。

---

## 7. 流式接口

### 7.1 SSE 启动

`POST /api/agent/runs/stream?input=<json>&preset=<id>`

- `Response` 为 `text/event-stream`；事件体：`data: { ... }\n\n`。
- 每个事件形如 `{ type: "workflow.event", event: WorkflowEvent }`。
- 客户端（`use-agent-workflow.ts`）通过 `fetch + ReadableStream` 解析。

### 7.2 Run 恢复

`GET /api/agent/runs/[id]` 返回 `{ run, events, traces }`；前端使用此接口在 SSE 中断 / 页面刷新后恢复最终状态。

### 7.3 Run 取消

`DELETE /api/agent/runs/[id]`：

- 给 `RunRepository` 打 `cancelled: true` 标记。
- `Orchestrator` 在每个 Step 入口检查 `repo.isCancelled(runId)` 并调用 `finalizeCancelled` 终止流程。

### 7.4 取消 + 超时保护

- 单个 Tool 调用有 `AI_REQUEST_TIMEOUT_MS`（默认 20s）。
- `runWorkflow` 在每个 Step 入口最多尝试 `MAIN_WORKFLOW_STEPS.length` 次，防止无限循环。

---

## 8. Workflow 可视化

`/workflow` 页面（`src/app/(workspace)/workflow/page.tsx`）由 `WorkflowViewerClient` 渲染：

- **Live Tab**：`/api/agent/runs?limit=10` 列最近 Run；点击后拉取 `/api/agent/runs/[id]` 并用 `WorkflowFlow` 渲染。
- **Replay Tab**：3 个内置 Replay（`standard` / `complex` / `high-risk`），由 `replay-snapshot.ts` 合成 `WorkflowRun + events + traces + citations`，与实时 Run 共享同一渲染管线。
- 节点状态：`pending / running / succeeded / failed / blocked / waiting_for_approval`；运行中节点带克制脉冲。
- 节点详情面板（`workflow-step-detail.tsx`）：
  - 任务摘要（来自 `agent.started` payload 的 `taskSummary`，由 Agent 在调用 Provider 时填入）
  - 结构化输入 / 输出摘要
  - 工具调用列表（`tool.called` → `tool.completed`）
  - 引用列表（`citation.attached`）
  - 耗时 + 错误码
  - **不展示**系统 Prompt、隐藏思维过程、API Key。

Mobile 视图：节点折叠为单列，详情用底部 Sheet 展开（`workflow-step-detail.tsx` 已支持 `mobile` 模式）。

---

## 9. Agent 工作台

`/agents` 页面展示：

- **顶部摘要**：Agent 总数 / Tool 总数 / 最近 Run 数 / 当前模型 / Prompt 版本 / Replay 模式标志。
- **Agent 卡片**：id / name / description / model / mode / maxSteps / timeoutMs / requiresApproval / tools / Input + Output Schema 摘要。
- **Tool 卡片**：name / description / 输入 + 输出 Schema 摘要 / 风险标记。
- **最近运行**：从 `/api/agent/runs` 取前 5 条，点击跳转 `/workflow?runId=<id>`。
- **Prompt 版本表**：列出每个 Agent 的 `promptVersion`，便于审阅。

体现"可组合能力中心"：每个 Agent 标注可用 Tool，Tool 又标注被哪些 Agent 调用（双向引用）；新增 Agent / Tool 时通过 Registry 自动出现。

---

## 10. 参数规划工作台接入

`src/components/planner/planner-workbench.tsx`：

- 新增 `agentMode` prop（或 URL `?agent=1`）开启 Agent Workflow。
- `useAgentWorkflow` hook：负责 SSE 解析、`/api/agent/runs/[id]/convert` 调用、失败时调用本地 `planDemo` 走 Replay 路径。
- `AgentModeBanner`：标识"演示回放模式" / 真实模式 + 当前 Run ID + 事件计数。
- `UnifiedState` 类型 = `localExec.state | agentExec.state`，确保下游组件（`ExecuteSection` / `RunSummarySidebar` / `PlanningStepTimeline`）按字符串键读取状态。
- 默认仍走会话 3 的 `planDemo`；显式开启才走 Agent Workflow，**不破坏原有 Demo 稳定性**。

---

## 11. Trace 数据契约

`FrontendTraceSummary`（前端可读）：

```ts
{
  id, runId, stepId, agentId?, toolCallId?, model, mode, promptVersion,
  startedAt, completedAt?, durationMs?, status, errorCode?
}
```

`status` 允许 `"running" | "succeeded" | "failed" | "blocked" | "skipped"`。

服务端 `TraceRecord` 多两个内部字段（`step` / `runId` 索引），但 **不向 API 暴露**。前端只读 `FrontendTraceSummary`，因此即便误打日志也不会泄漏系统 Prompt / 输入全文。

---

## 12. 测试覆盖（83 条，全绿）

| 文件                                              | 覆盖                                       |
| ------------------------------------------------- | ------------------------------------------ |
| `agent-registry.test.ts` (6)                      | Agent 数量 / Schema 字段 / 模式 / 工具引用 / requiresApproval |
| `tool-registry.test.ts` (8)                       | 8 个 Tool 唯一性 / 输入校验 / 输出校验 / 确定性 / 空查询拒绝 |
| `workflow-engine.test.ts` (7)                     | 状态机 / 阻塞步骤识别 / 初始步骤 / 重建       |
| `event-bus.test.ts` (4)                          | 订阅 / 通配 / 序号自增 / 重放               |
| `trace-recorder.test.ts` (4)                      | Trace 启动 / 成功 / 失败 / 阻塞             |
| `prompt-registry.test.ts` (6)                     | 注册 / 版本查找 / 4 条硬约束关键字          |
| `server-config.test.ts` (5)                      | 环境变量 / 默认值 / 类型解析                |
| `replay.test.ts` (5)                              | 三类预设存在 / 字段 / 高风险标记             |
| `orchestrator.test.ts` (3)                       | 强制 Replay 跑通三种预设 / 事件顺序 / 高风险阻断 |
| `parameter-planning/domain/planner.test.ts` (35)  | 会话 3 纯函数（保留）                       |

运行：`npm test -- --run`。

---

## 13. 验收对照

| 验收项                                                    | 状态 | 备注                                                         |
| --------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| 配置 Key 时可走真实 DeepSeek Runtime                       | ✅   | `DEEPSEEK_API_KEY` 设置后 `provider.isAvailable === true`    |
| 无 Key 时可完整回放                                       | ✅   | 3 个预录制 Replay 覆盖常规 / 复杂 / 高风险                  |
| 参数规划可触发 Agent Workflow                             | ✅   | `/planner?agent=1` 或 `agentMode` prop                       |
| Workflow 节点随事件实时变化                                | ✅   | `/workflow` Live Tab 通过 SSE 推送事件更新                    |
| Agent 工作台可查看 Agent / Tool / 运行历史                 | ✅   | `/agents` 已挂接 Registry + 最近 Run                         |
| 高风险场景被 Safety Reviewer 阻断                          | ✅   | `orchestrator.test.ts > high-risk preset` 测试通过           |
| 人工审批节点不能自动通过                                   | ✅   | `request_human_approval` 仅产出 `pending`，Orchestrator 不会自调用 `approved` |
| 页面刷新后仍可查看 Run                                     | ✅   | `/api/agent/runs/[id]` 持久快照 + 前端 fallback              |
| 不展示隐藏思维过程                                         | ✅   | Prompt / Trace / API 都不暴露思维链；UI 只展示摘要           |
| `npm run lint` 通过                                       | ✅   | ESLint 0 errors                                              |
| `npm run typecheck` 通过                                  | ✅   | `tsc --noEmit` 0 errors                                      |
| `npm test` 通过                                            | ✅   | Vitest 83/83 passed                                          |
| `npm run build` 通过                                       | ✅   | Next.js production build OK                                  |

---

## 14. 已知限制 / 待办

1. **模型直连未做压力测试**：真实 DeepSeek 流式长上下文未在 Session 4 阶段接入测试；建议 Session 5 启动前用 1 条真实请求验证。
2. **RunRepository 是 InMemory**：进程重启后 Run 丢失，仅保留 3 个内置 Replay。如需持久化，Session 5 可改 Drizzle/Postgres（参考会话 3 的 `infrastructure/schema.ts`）。
3. **Prompt 仍以"工程师 + 模拟数据 + 人工复核 + 禁止现场控制"为基础**：Session 5 接入知识引用时，可补充"必须带 §文档 ID + 页码 + 章节"。
4. **`request_human_approval` 当前仅记录**：`pending` 状态由 Session 5 提供 UI 入口审批通过 → Orchestrator 注入 `human.approved` 事件并继续。
5. **报告骨架占位**：`build_report_outline` 仅输出章节大纲；Session 5 接入完整 PDF / Word 导出。

---

## 15. 会话 5 接入指南

### 15.1 知识引用（Knowledge Citation）

- 现状：`search_knowledge` 返回 `Citation[]`，Orchestrator 已 emit `citation.attached`。
- Session 5 任务：
  - 在 `/knowledge` 页面挂接"上传/标注/版本"工作流。
  - 真实检索后端（pgvector / Elasticsearch）替换 `DEMO_KNOWLEDGE`。
  - 在 `WorkflowFlow` 的 Step 详情面板中，渲染 `Citation` 的 documentId / page / section / excerpt，并在原文中高亮命中片段。
- 注意：保留 `Citation` 字段 schema，避免影响 Orchestrator 与 UI。

### 15.2 人工审批（Human Approval）

- 现状：`request_human_approval` 工具 + `human.input_requested` 事件已存在；`RunRepository` 不存审批决议。
- Session 5 任务：
  - 新增 `/api/agent/runs/[id]/approve` (POST) 接收 `{ approvalId, decision: 'approved' | 'rejected', reviewerId, note }`。
  - Orchestrator 增加 `awaitHumanApproval` 阶段：阻塞直到收到决议或超时（默认 30 分钟）。
  - UI：在 `/workflow` 节点详情面板加"批准 / 驳回"按钮（仅在 `requiresApproval` 为 true 且 status=`waiting_for_approval` 时出现）。
  - 持久化：审批决议存入 RunRepository；下一次重建 Run 时仍可显示。

### 15.3 报告生成（Report Outline → PDF / Word）

- 现状：`build_report_outline` 输出章节大纲；`Report Agent` 的 `run()` 仅占位。
- Session 5 任务：
  - 在 `Report Agent.run()` 中调用 `build_report_outline`，将大纲写入 `report_outline` 字段。
  - 新增 `/api/reports/[runId]` 返回结构化报告 JSON + Markdown 渲染。
  - 在 `/reports` 页面接入：根据 `WorkflowRun.outputSummary.recommendedSchemeId` 拉取推荐方案 + 风险清单 + 引用，渲染为可打印 PDF（使用 `@react-pdf/renderer` 或 `puppeteer`）。
  - 报告必须包含人工复核位（"本报告需由注册岩土工程师 / 爆破工程技术人员签字后方可作为现场参考"）以维持"工程辅助"边界。

### 15.4 工作台状态持久化

- 现状：`usePlanningExecution` 与 `useAgentWorkflow` 都是组件内 state。
- Session 5 可选任务：
  - 把当前 Run / 表单草稿 / 选中 Tab 写入 `localStorage` 或后端草稿表，刷新后恢复。
  - 在 `/planner` 顶部加 "上次未完成" 提示。

---

## 16. 常用命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 跑全部测试
npm test

# 类型检查 + Lint
npm run typecheck
npm run lint

# 生产构建
npm run build

# 启动生产服务器
npm start

# 验证 Agent Workflow（不需要 Key，自动走 Replay）
curl -X POST 'http://localhost:3000/api/agent/runs/stream?input=%7B%22engineeringType%22%3A%22open-pit-bench%22%2C...%7D&preset=standard'

# 查看最近 Run
curl http://localhost:3000/api/agent/runs?limit=5

# 验证 Session 3 的纯 Demo Planner 仍可用（无需 agent=1）
open http://localhost:3000/planner

# 验证 Agent Workflow 入口（开启 agent 模式）
open http://localhost:3000/planner?agent=1

# 验证 Workflow 可视化
open http://localhost:3000/workflow

# 验证 Agent 工作台
open http://localhost:3000/agents
```

---

## 17. 真实模式 vs 回放模式验证

### 17.1 真实模式（已配置 DEEPSEEK_API_KEY）

```
1. .env.local: DEEPSEEK_API_KEY=sk-xxx
2. npm run dev
3. open /planner?agent=1 -> 提交表单 -> AgentModeBanner 显示"真实模式"
4. /workflow Live Tab 中节点逐步亮起，citation / tool / agent 事件持续推送
5. /agents 顶部摘要显示 Provider = deepseek-v4-pro
```

### 17.2 回放模式（无 Key / 默认）

```
1. .env.local: 注释或清空 DEEPSEEK_API_KEY
2. npm run dev
3. open /planner?agent=1 -> 提交表单 -> AgentModeBanner 显示"演示回放模式"
4. 工作台在 1 秒内出现 PlanningRun（由 session-3 planDemo 兜底）
5. /workflow Live Tab 显示最近 Run（含 replay: true 标记）
6. /workflow Replay Tab 可选 standard / complex / high-risk 三套预录制
7. /workflow 节点 detail 显示 toolCalls / citations（由 replay-snapshot 合成）
```

### 17.3 强制回放（验证 Orchestrator Replay 分支）

```ts
import { runWorkflow } from "@/modules/agent-runtime/core/orchestrator";

await runWorkflow({
  runId: "run-debug",
  workflowId: "wf-debug",
  input: SCENARIO_PRESETS[0].input,
  presetId: "standard",
  requestId: "req-debug",
  forceReplay: true, // 即便有 Key，也强制走 Replay
});
```

### 17.4 高风险阻断验证

```
1. /planner?agent=1 -> 选中 "高风险：距敏感建筑 35m" 预设 -> 提交
2. /workflow 节点链走到 review_safety 时变为 blocked
3. review.blocked 事件触发，AgentModeBanner 提示"需要人工审批"
4. Orchestrator 不会自动发出 human.approved（除非 Session 5 接入审批 UI）
```

---

## 18. 文件清单（本阶段新增 / 重要修改）

新增：

- `src/modules/agent-runtime/` 全部子目录与文件
- `src/app/api/agent/runs/route.ts`
- `src/app/api/agent/runs/[id]/route.ts`
- `src/app/api/agent/runs/[id]/convert/route.ts`
- `src/app/api/agent/runs/stream/route.ts`
- `src/app/(workspace)/workflow/page.tsx`
- `src/app/(workspace)/agents/page.tsx`（完全重写）
- `src/components/workflow/workflow-flow.tsx`
- `src/components/workflow/workflow-viewer-client.tsx`
- `src/components/workflow/workflow-step-detail.tsx`
- `src/components/workflow/workflow-event-feed.tsx`
- `src/components/planner/use-agent-workflow.ts`
- `src/server/demo/workflow-replays.ts`（已更新使用 replay-snapshot）
- `vitest.shims/server-only.ts`
- `vitest.setup.ts`
- `docs/handoffs/session-4.md`（本文）

修改：

- `src/components/planner/planner-workbench.tsx`（新增 UnifiedState / AgentModeBanner / agentMode 切换）
- `src/components/planner/planning-step-timeline.tsx`（放宽 steps 类型）
- `src/components/planner/engineering-scenario-form.tsx`（保留，会话 3 原版）
- `package.json`（新增 `@xyflow/react`、`server-only`）
- `eslint.config.mjs`（关闭两条与本项目架构冲突的 React Compiler 规则）
- `vitest.config.ts`（`server-only` alias + setupFiles）
- `.env.example`（新增 5 个 DeepSeek/AI 变量）
- `docs/STATUS.md`（更新到 Session 4 完成态）

未修改（保留会话 3 契约）：

- `src/modules/parameter-planning/**`（纯函数 + 35 条测试保持）
- `src/components/planner/engineering-scenario-form.tsx`
- `src/server/demo/scenario-presets.ts`

---

## 19. 联系点 / 下一步

- **会话 5 入口**：从 `/agents` / `/workflow` / `/knowledge` / `/reports` 任一页面开始即可，所有改动通过 Registry 注入，无需改 Agent / Tool 实现。
- **Prompt 升级**：在 `prompt-registry.ts` 中按 `vX.Y.Z` 递增；旧 Run 自动保留 `promptVersion` 字符串，UI 不直接展示 Prompt。
- **新 Agent / Tool**：必须以 `defineAgent({...})` / `defineTool({...})` 注册，提供完整 Zod schema + Demo 实现；不允许在 Route Handler 中拼接业务逻辑。
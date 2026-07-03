# 爆擎 BlastForge

> **AI 原生爆破工程辅助决策与协同平台**

爆擎 BlastForge 面向爆破工程领域，将工程参数规划、专业知识检索、多 Agent 协同、风险复核、人工确认和报告生成整合为一套可执行、可解释、可追踪的智能工作流。

当前仓库交付的是面向模拟商业会议的高完成度 Demo：5 个核心模块（驾驶舱 / Planner / Workflow / Knowledge / Approvals / Reports）+ 3 个预设场景 + 完整 RAG + 完整人工复核 + 完整报告 + 打印 / PDF 导出。

---

## 项目定位

```text
工程条件输入
    ↓
参数标准化（确定性纯函数）
    ↓
知识库检索（RAG：Query Rewrite → Metadata Filter → Keyword + Vector Adapter → Merge → Rerank → Citation Packaging）
    ↓
爆破参数预测与方案规划（多 Agent）
    ↓
多方案生成与评分
    ↓
安全复核（确定性规则）
    ↓
人工确认（HITL，不可绕过）
    ↓
报告生成（来自同一 Planning Run）
```

当前阶段重点验证：

- 爆破工程参数预测与规划
- DeepSeek-V4-Pro 模型接入
- 多 Agent 协同 + Agentic Workflow
- RAG 知识检索与可追踪引用
- Tool Calling + 人工确认
- 高完成度商业展示体验

---

## 技术栈（与代码一致）

| 领域 | 实际依赖 |
| ---- | -------- |
| 框架 | Next.js 16 App Router + React 19 |
| 语言 | TypeScript（Strict） |
| 样式 | Tailwind CSS v4（含 `@theme` Token） |
| UI | 自研 `src/components/ui/*`（按 shadcn/ui 风格） |
| 动画 | `motion@12` + `useReducedMotion` 兼容 |
| 图表 | ECharts 6（`next/dynamic` 按需加载） |
| 工作流 | React Flow (`@xyflow/react@12`) |
| 表单 | React Hook Form + Zod |
| 客户端状态 | Zustand |
| 服务端 | Next.js Route Handlers + `server-only` |
| 模型 | DeepSeek（OpenAI-compatible Provider Adapter） |
| 检索 | 自研 RAG Pipeline（关键词 + 可选向量 Adapter） |
| 测试 | Vitest 4 |
| Lint / 类型 | ESLint + `tsc --noEmit` |

> 不引入：TanStack Query（暂不需要）、外部 PDF 渲染、Redis / Postgres（默认 In-Memory Repository，可平滑切换到 Drizzle / pgvector — Schema 蓝图已就位）。

---

## 安装与运行

```bash
# 1. 安装依赖（推荐 npm）
npm install

# 2. 环境变量（可选，仅在希望走真实 DeepSeek 调用时配置）
cp .env.example .env.local
# 按需填入 DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL

# 3. 开发
npm run dev
# 打开 http://localhost:3000

# 4. 测试 / 类型检查 / 构建
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm run test      # Vitest 124 条
npm run build     # Next.js 生产构建
```

---

## 环境变量

| 变量 | 用途 | 默认 |
| ---- | ---- | ---- |
| `DEMO_REPLAY_ENABLED` | 强制使用预录制 Run（即使有 Key） | `1`（缺 Key 时自动启用） |
| `DEEPSEEK_API_KEY`    | DeepSeek 鉴权（仅服务端可读） | 未配置 → 自动 Replay |
| `DEEPSEEK_BASE_URL`   | DeepSeek 兼容端点 | `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL`      | 主模型 | `deepseek-v4-pro` |
| `AI_REQUEST_TIMEOUT_MS` | 单次 AI 请求超时 | `15000` |

**安全约束**：

- 严禁使用 `NEXT_PUBLIC_` 前缀暴露 Key。
- 严禁把 `.env*` 加入提交。

---

## 数据库 / 持久化

- **默认：In-Memory Repository**。`KnowledgeRepository` / `RunRepository` / `ReportRepository` / `HumanApprovalService` 全部为 demo 安全的内存实现。
- **可选：Drizzle / PostgreSQL / pgvector**。`src/db/schema` 蓝图已就位，可平滑切换；向量检索通过 `VectorAdapter` 接入，缺 Embedding 服务时自动回退关键词。
- 当前 Demo 不依赖任何外部数据库。

---

## Demo Replay（回放模式）

Orchestrator 在 Provider 不可用 / 超时 / Schema 失败时会自动降级到预录制 Run：

- 3 套预录制 Run 覆盖 `standard` / `complex` / `high-risk` 三个预设场景。
- UX 不暴露「失败」状态；前端通过 `DemoModeBadge` 显示「回放模式」徽章。
- 设置 `DEMO_REPLAY_ENABLED=1` 可强制走 Replay，适合网络隔离环境。

---

## 演示入口（5 个核心模块）

| 路由 | 角色 |
| ---- | ---- |
| `/` | 品牌首页：Hero + 能力分布 + 9 节点 Agent 协作网络 |
| `/dashboard` | 智能驾驶舱：项目 / Run 时间线 / Agent 池 / 风险 / 引用 / 演示模式入口 |
| `/planner` | **参数规划**（含 Agent Workflow + 引用面板 + 报告生成按钮） |
| `/workflow` | **Agentic Workflow 可视化**（React Flow + 节点详情 + 引用） |
| `/knowledge` | **知识库**（8 文档 + 17 chunk + 检索测试 + Demo 上传入口） |
| `/approvals` | **人工复核中心**（accept / modify / reject / return） |
| `/reports` | **报告中心**（列表 + 预览 + 打印 PDF + Markdown + JSON） |
| `/agents` | Agent / Tool 元数据 |

演示顺序详见 [`docs/demo-script/`](./docs/demo-script/00-demo-overview.md)。

---

## 关键 API

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| GET    | `/api/agent/runs` | 最近 Run 列表 |
| POST   | `/api/agent/runs/stream` | SSE 启动 Workflow Run |
| GET    | `/api/agent/runs/[id]` | 查询 Run |
| DELETE | `/api/agent/runs/[id]` | 取消 Run |
| POST   | `/api/agent/runs/[id]/convert` | 转为 `PlanningRun` |
| GET    | `/api/agent/approvals` | 列出全部待复核 / 单 Run 快照 |
| POST   | `/api/agent/approvals` | 改变状态（accept / modify / reject / return） |
| GET    | `/api/reports?format=md\|json\|html` | 报告（导出支持 MD / JSON / HTML） |
| POST   | `/api/reports` | 生成报告 |

---

## 测试

```bash
npm run test
```

当前覆盖（Vitest 124/124）：

| 模块 | 文件 |
| ---- | ---- |
| Planner 纯函数 | `src/modules/parameter-planning/domain/planner.test.ts` |
| Agent Registry | `src/modules/agent-runtime/core/agent-registry.test.ts` |
| Orchestrator | `src/modules/agent-runtime/core/orchestrator.test.ts` |
| Replay | `src/modules/agent-runtime/core/replay.test.ts` |
| Tool Registry | `src/modules/agent-runtime/core/tool-registry.test.ts` |
| RAG Pipeline | `src/modules/knowledge/domain/retrieval.test.ts` |
| Knowledge Repository | `src/modules/knowledge/infrastructure/repository.test.ts` |
| Safety Reviewer | `src/modules/safety-review/domain/checker.test.ts` |
| Human Approval Service | `src/modules/human-review/domain/service.test.ts` |
| Report Builder | `src/modules/report/domain/builder.test.ts` |

---

## 安全与责任边界

- Demo **不向外部网络开放任何施工指令通道**。
- **不通过 DeepSeek 调用执行任何具体施工操作**。
- 所有方案结果都需经人工复核签字后才能进入下一步。
- 知识库内容明示 `sourceType`（knowledge / regulation / case / material）+ `category`，引用展开可回溯原文。禁止冒充正式规范。
- `DEEPSEEK_API_KEY` 仅服务端可读，不暴露到前端 Bundle。
- 高风险场景（`environmentSensitivity=high`、工程类型属于 underground / tunnel / urban-excavation）由 Safety Reviewer 阻断；未走完 HITL 之前 Agent 不得继续。
- 不引入必须在线的单一外部服务；OpenAI-compatible DeepSeek 失败 → 自动 Replay。

---

## 文档结构

```text
docs/
├── STATUS.md                  # 当前开发状态
├── TASKS.md                   # 任务清单
├── DECISIONS.md               # 关键决策
├── 爆擎_BlastForge_Demo技术设计规范.md   # 设计规范
├── demo-script/               # 演示脚本
│   ├── 00-demo-overview.md
│   ├── 01-main-scenario.md
│   ├── 02-risk-block-scenario.md
│   ├── 03-agent-architecture.md
│   └── 04-fallback-plan.md
└── handoffs/                  # 五阶段交接
    ├── session-1.md
    ├── session-2.md
    ├── session-3.md
    ├── session-4.md
    └── session-5.md
```

---

## 已知限制

- 内存 Repository 当前不持久化；切换数据库按 `src/db/schema` 蓝图迁移。
- `PresentationScriptBar` 默认未自动播放；演示者手动触发，避免「假演示」。
- 浅色主题切换时图表颜色需刷新页面（缓存在 `chart-theme.ts`）。
- 浏览器自动化 E2E 暂未接入 Playwright；后续可扩展。

---

## License

当前项目授权方式待定。

在正式确定开源或商业授权方式前，请勿将项目代码、知识库资料和 Demo 数据用于未经授权的商业用途。

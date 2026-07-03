# Session 3 Handoff — 爆破参数预测与方案规划核心工作台

> 目标：为会话 4（DeepSeek Agent Runtime 接入）准备可替换、可观测、可演化的契约与执行编排层。

---

## 1. 范围与交付

本阶段在 **不接入真实 DeepSeek** 的前提下，构建“爆破参数预测与方案规划”完整 Demo 工作台：

- 路由 `/planner` 从骨架升级为工作台（Desktop 三栏 / Mobile 步骤式）。
- 三类预设：常规规划 / 复杂约束 / 高风险拦截。
- 表单 12 字段（含自然语言补充），自动保存草稿、Zod 校验、不弹 alert。
- 确定性 Demo Planner：参数标准化 → 规则预检 → 方案生成 → 评分 → 风险与人工复核字段 → 敏感性矩阵。
- 三类图表：方案雷达图、核心参数对比柱状图、参数敏感性热力图。
- 状态机驱动执行体验：6 步 timeline、可取消 / 重置、高风险自动 blocked。
- 数据访问层抽象：Repository 接口 + In-Memory Demo 实现 + Drizzle Schema 蓝图；**无数据库可启动**。
- 35 条 Vitest 单元测试覆盖核心纯函数。

---

## 2. 模块结构（不可随意调整）

```
src/modules/parameter-planning/
├── domain/
│   ├── contracts.ts        # Zod Schema + 类型契约（SourceKind 预留）
│   ├── constants.ts        # 静态业务常量 / 标签
│   ├── planner.ts          # 确定性纯函数（替换点见 §4）
│   ├── presets.ts          # 三类预设场景
│   └── planner.test.ts     # 35 条 Vitest
├── infrastructure/
│   ├── repository.ts       # PlanningRepository 接口
│   ├── demo-repository.ts  # 内存实现（默认）
│   ├── schema.ts           # Drizzle Schema 蓝图（注释）
│   └── index.ts
└── index.ts                # 模块 barrel
```

```
src/components/planner/
├── planner-workbench.tsx        # 顶层编排（Desktop/Mobile）
├── engineering-scenario-form.tsx # RHF + Zod 表单
├── planning-step-timeline.tsx   # 执行 Timeline
├── scheme-comparison-list.tsx   # 推荐/备选/风险列表
├── scheme-detail-panel.tsx      # 选中方案详情
├── scheme-radar-chart.tsx       # 多方案雷达
├── scheme-bar-chart.tsx         # 核心参数柱图
├── sensitivity-heatmap-chart.tsx# 参数敏感性热力图
├── planner-chart-tabs.tsx       # 图表切换
├── charts.tsx                   # 动态导入图表
├── form-fields.ts               # 字段元数据
└── use-planning-execution.ts    # 状态机 Hook

src/stores/planner-store.ts      # Zustand: 选择 / UI
```

---

## 3. 核心契约（会话 4 必须遵守）

### 3.1 SourceKind 矩阵

会话 4 接入模型时，必须为每个被模型“建议/替换”的字段标注来源：

| SourceKind            | 含义                                       | 现阶段使用方                |
|-----------------------|--------------------------------------------|-----------------------------|
| `user_input`          | 用户/表单原值                              | `BlastScenarioInput`        |
| `normalized`          | Demo Planner 标准化后的值                  | `NormalizedParameterSet`    |
| `rule_modified`       | 规则强制修正后的值                         | `NormalizedParameterSet`    |
| `model_suggested`     | 模型建议占位值（**会话 4 启用**）          | `PredictedParameter`        |
| `human_confirmed`     | 人工复核后的值                             | `PredictedParameter`        |

> 注：`PredictedParameter` 当前由 Demo Planner 直接生成 `model_suggested`；会话 4 接入真实模型后，模型输出走 `model_suggested`，再叠加 `human_confirmed` 标记。

### 3.2 不可修改的契约（实现方需保持稳定）

| 类型                         | 文件                  | 说明 |
|------------------------------|-----------------------|------|
| `BlastScenarioInput`         | `domain/contracts.ts` | 表单 / 数据访问输入；Zod 校验唯一入口 |
| `NormalizedParameterSet`     | `domain/contracts.ts` | 标准化输出；标准字段映射规则见 `planner.ts:normalizeParameters` |
| `PlanningRun`                | `domain/contracts.ts` | 持久化 / Run 主对象；**会话 4 会在 Step Events 上叠加 `model_*` 字段，但不得删现有字段** |
| `Scheme` / `SchemeScore`     | `domain/contracts.ts` | 业务展示层使用；评分权重见 `resolveScoreWeights` |
| `RiskItem` / `ReviewRequirement` | `domain/contracts.ts` | UI 通过统一 RiskBadge 消费 |

### 3.3 工作流事件

```ts
type PlanningStepId =
  | "validate_input"
  | "normalize_parameters"
  | "run_rule_precheck"
  | "plan_parameters"
  | "generate_schemes"
  | "calculate_scores"
  | "review_safety"
  | "await_human_review";

type PlanningStepStatus =
  | "pending" | "running" | "succeeded" | "warning"
  | "blocked" | "skipped" | "failed";
```

**会话 4 增加事件类型时**：扩展 `PlanningStepId` 联合、保持 `PlanningStepStatus` 兼容，并在 UI timeline 注入。

---

## 4. Demo Planner 替换点

会话 4 的目标：用 DeepSeek + 规则混合推理替换 `planner.ts` 的纯函数族。**只替换实现，不替换签名**。

### 4.1 单一入口

```ts
// src/modules/parameter-planning/domain/planner.ts
export function planDemo(input: PlanningPipelineInput): PlanDemoResult
```

签名固定：

```ts
export interface PlanningPipelineInput {
  input: BlastScenarioInput;
  presetId?: string;
  projectId?: string;
  /** 注入时间，让结果稳定可复现 */
  simulatedNowIso?: string;
  /** 未来扩展：Agent Runtime 可注入已生成的 partialNormalized */
  partialNormalized?: Partial<NormalizedParameterSet>;
}

export interface PlanDemoResult {
  run: PlanningRun;
  steps: PlanningStepEvent[];
}
```

### 4.2 可被替换的阶段函数

| 阶段                    | 函数                      | 当前实现     | 会话 4 替换方式 |
|-------------------------|---------------------------|--------------|-----------------|
| 参数标准化              | `normalizeParameters`     | 纯规则       | 可保留 / 改为模型前处理 |
| 规则预检                | `runRulePrecheck`         | 硬编码规则   | **保留** 作为安全网；模型输出须经过此函数二次校验 |
| 方案参数生成            | `planParameters`          | 查表/插值    | **替换** 为模型输出（含 `SourceKind = model_suggested`） |
| 评分                    | `calculateSchemeScore`    | 加权平均     | **保留**（结果可被模型解释覆盖） |
| 风险识别                | `collectRisks`            | 阈值+规则    | **保留** |
| 人工复核字段            | `collectReviewRequirements` | 启发式     | **保留** |
| 敏感性                  | `analyzeSensitivity`      | 固定扰动     | 替换为模型解释（如 Shapley 值），**仍输出同结构** |
| Run 状态汇总            | `summarizeRunStatus`      | 优先级表     | **保留** |

### 4.3 替换流程（会话 4 参考）

1. 在 `planner.ts` 增加 `planWithAgent(input, agent)`，内部 `agent.plan(...)` 取代 `planParameters`；
2. 强制将模型输出经过 `runRulePrecheck` → 不合规项自动 `model_suggested` 改为 `rule_modified`；
3. `run` 仍由 `buildRun(...)` 装配 → 保证 `PlanningRun` 字段稳定；
4. 若 Agent Runtime 抛错 / 超时：回退到 `planDemo(...)`，状态写 `failed` 或 `awaiting_review`。

---

## 5. Workflow 事件与 UI 联动

`use-planningExecution` 当前通过 `setState` 直接驱动 `steps: PlanningStepEvent[]`。
会话 4 接入 Agent Runtime 后，事件来源需切换为流式订阅：

| 当前实现                                | 会话 4 建议                                   |
|-----------------------------------------|----------------------------------------------|
| `setInterval` + 同步 planDemo           | Agent Runtime 通过 `subscribe(stepId, payload)` 推送 |
| `dispatchEvent` 用 `setState`           | 改为 `useReducer` + 中间件，统一处理 `pending → running → succeeded/blocked` |
| `await wait(stepDurationMs, …)`         | 替换为 `await agent.next()`                   |

UI 侧（`PlanningStepTimeline`）**不依赖具体事件源**，只看 `steps: PlanningStepEvent[]` 的形状。

---

## 6. 数据层迁移清单

### 6.1 接口（已完成）

`PlanningRepository`（`infrastructure/repository.ts`）：

- `listPresets()` / `listRecentScenarios()` / `listPlanningRuns()`
- `createPlanningRun(input)` / `rerunPlanning(scenarioId, input)` / `getRunById(runId)`

### 6.2 数据库适配（占位）

`infrastructure/schema.ts` 给出 Drizzle/Postgres 蓝图（含 `projects` / `blast_scenarios` / `planning_runs` / `schemes` / `scheme_scores`），**会话 4 不需要立即落地**。

切换条件：`process.env.DATABASE_URL` 存在且未设置 `DEMO_REPOSITORY=1`。
**当前会话保持内存实现**。

---

## 7. UI 状态契约（Zustand）

`src/stores/planner-store.ts`：

- `useSelectionStore.selectedSchemeId` — 持久化
- `usePlannerUIStore.{ mobileStep, detailsOpen, chart }` — 部分持久化

**禁止把 `PlanningRun` 整对象塞进 Store**。`PlanningRun` 通过 props / React Query 流入。

URL 同步：`searchParams` 已支持 `preset`、`scheme`、`chart`。

---

## 8. 测试基线（35/35 通过）

`src/modules/parameter-planning/domain/planner.test.ts`：

- Zod 参数校验 / 标准化稳定
- 规则冲突检测
- 高风险 blocked
- 评分稳定 + 同输入结果稳定
- 方案排序
- planDemo 端到端

会话 4 增加：

- 模型响应解析（`DeepSeekResponse → Scheme[]`）的 schema 校验；
- Agent Runtime mock 的回归测试；
- 替换路径在规则不通过时的回退测试。

---

## 9. 已知事项 / 后续建议

| 项               | 状态     | 后续处理 |
|------------------|----------|----------|
| React Compiler + RHF `watch()` 警告 | 已知 | 不影响运行；如需消除可换 `useWatch` |
| ECharts dynamic import            | 已做   | Mobile 图表 lazy；进一步可分 chunks |
| 真实 DeepSeek 集成                | 未做   | 会话 4 |
| 服务端持久化 / 多用户隔离         | 未做   | 会话 4-5 |
| AGENTS.md 强制规则                | 已遵守 | 单引号 / Server-first / 集中状态 |

---

## 10. 验收复现

```bash
cd web
npm run typecheck   # 通过
npm run lint        # 0 errors（1 已知 RHF watch 警告）
npm run test        # 35/35
npm run build       # 9 routes（含 /planner）构建通过
```

桌面：访问 `/planner`，三栏布局 + Timeline + 雷达/柱图/热力图联动。
Mobile：步骤式流程（场景输入 → 参数确认 → 执行规划 → 方案对比 → 风险与确认）。
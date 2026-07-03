# Agent 架构讲解（03）

预计 3 分钟。配合 `/workflow` 与 `/knowledge` 页面。

## 1. 10 个 Workflow Step（1 分钟）

操作：
- 在 `/workflow` 选中任意 Run 状态为「succeeded」的节点。
- 节点详情面板从左到右展示：输入 → 输出摘要 → 调用的 Tool → 引用 → Trace 摘要。

讲解：
- `validate_input`：Zod 校验 12 字段。
- `call_demo_planner` / `parameter_normalize`：确定性的纯函数规划，零幻觉。
- `agent.rule_precheck`：基于 `runRulePrecheck` 规则集。
- `agent.retrieve`：RAG 检索关键词 + 元数据，可选向量。
- `agent.scenario_analyzer` / `agent.scheme_planner`：DeepSeek Agent，含 prompt version。
- `agent.risk_review`：风险清单聚合。
- `agent.safety_review`：确定性 Safety Reviewer，人工重点确认清单生成。
- `await_human_review`：人工审批节点（强制）。
- `agent.report_writer`：从单一 Run 组装报告（不重新随机）。

## 2. 8 个 Agent + 9 个 Tool（45 秒）

操作：
- 导航到 `/agents`。
- 滚动浏览 Agent / Tool 卡片。

讲解：
- 每个 Agent 包含 `id / name / model / tools / maxSteps / timeoutMs / promptVersion`。
- `RunSafetyReviewTool` 在 Session 5 新增，对接 Safety Reviewer 模块的确定性规则。
- 所有 Tool 都强制 Zod 校验输入输出；Prompt / Key 不暴露。

## 3. 知识库与 RAG（45 秒）

操作：
- 导航到 `/knowledge`。
- 在「检索测试」框中输入「含水 抗水 乳化」。
- 点击检索 → 命中片段列表。

讲解：
- `Query Rewrite` 提取中文 token + 类别 + 来源类型。
- `KeywordAdapter`（必选）+ `VectorAdapter`（可选，未启用时回退）。
- 命中片段会显示：文档名 / 章节页码 / 相关度 / 使用 Agent / 影响结论。
- 强调：不伪造不存在的引用，所有命中都来自 8 份种子文档。

## 4. Trace 与可观测性（30 秒）

操作：
- 在 `/workflow` 节点详情面板展开「Trace 摘要」。

讲解：
- 每个 Tool 记录 `startedAt / durationMs / status / inputSummary / outputSummary`。
- 摘要不暴露 API Key 或 Prompt 原文。
- 完整 Trace 仅服务端可读，且按 `runId` 关联 `RunRepository`。

## 收尾

讲解：
- Agent 与 Tool 注册在 `/src/modules/agent-runtime/core/registry.ts` 与 `tool-registry.ts`。
- 任何新增能力都通过 Zod 契约 + Provider Adapter 接入，不破坏既有 Runtime。

# Session 5 交接（RAG / 引用 / 人工复核 / 报告 / Demo 串联）

日期：2026-07-04
会话：第 5 阶段（最终集成与交付）
主要交付：

1. 知识库数据模型 + In-Memory Repository（无数据库可启动）
2. 8 份教学 / 规范摘要 / 案例摘要种子文档 + 17 chunk（覆盖 5 大主题）
3. RAG 检索层（Query Rewrite + Metadata Filter + Keyword Adapter + 可选 Vector Adapter + Merge + Rerank + Citation Packaging + 0 命中安全过滤）
4. 知识库完整页面（文档 / 检索测试 / 命中片段 / 命中得分 / 来源 / 章节 / Agent）
5. 引用面板（`CitationPanel`）—— 强制含文档名 / 章节页码 / 命中片段 / 得分 / Agent / 结论，禁止「仅来自知识库」
6. Safety Reviewer 升级：缺失参数 / 规则冲突 / 模型 vs 规则 / 缺引用 / 高风险字段 / 人工确认清单
7. Human-in-the-loop（`HumanApprovalService` + `/api/agent/approvals` + `/approvals` + `RequestHumanApprovalTool` / `RunSafetyReviewTool`）
8. 报告中心：`/reports` 完整页 + `ReportRepository` + `/api/reports`（list / detail / MD / JSON / HTML / create）+ 报告来自同一 Run
9. 打印 / PDF（HTML 优化版）+ Markdown + JSON
10. 演示模式开关 + 重置 + 预设切换
11. Vitest 124 条覆盖 RAG / Safety / Approval / Report / Knowledge
12. `npm run lint` / `typecheck` / `test` / `build` 全部通过
13. README、STATUS、TASKS、demo-script/* 更新
14. 没有推翻前 4 个会话的架构

---

## 关键文件 / 目录

| 路径 | 作用 |
| ---- | ---- |
| `src/modules/knowledge/domain/contracts.ts` | 知识库 Zod 契约 |
| `src/modules/knowledge/domain/seed-data.ts` | 8 文档 / 17 chunk 种子数据 |
| `src/modules/knowledge/domain/retrieval.ts` | RAG Pipeline（Query Rewrite / Metadata Filter / Keyword / Vector / Merge / Rerank / Citation） |
| `src/modules/knowledge/infrastructure/repository.ts` | In-Memory Knowledge Repository（`server-only`） |
| `src/modules/safety-review/domain/contracts.ts` | Safety Reviewer 契约 |
| `src/modules/safety-review/domain/checker.ts` | 确定性 Safety Reviewer |
| `src/modules/human-review/domain/contracts.ts` | HITL Zod 契约 |
| `src/modules/human-review/domain/service.ts` | HumanApprovalService |
| `src/modules/report/domain/contracts.ts` | Report 契约 |
| `src/modules/report/domain/builder.ts` | buildReport（来自单一 Run） |
| `src/modules/report/domain/exporters.ts` | Markdown / HTML / JSON |
| `src/modules/agent-runtime/core/tool-registry.ts` | 接入 SearchKnowledgeTool 新 RAG、RequestHumanApprovalTool、RunSafetyReviewTool |
| `src/app/(workspace)/knowledge/page.tsx` | 完整知识库页面 |
| `src/app/(workspace)/approvals/page.tsx` | 完整人工复核中心 |
| `src/app/(workspace)/reports/page.tsx` | 完整报告中心 |
| `src/app/api/agent/approvals/route.ts` | Approvals API |
| `src/app/api/reports/route.ts` | Reports API（GET 列表 / 单报告 / MD / JSON / HTML；POST 生成） |
| `src/components/citation/citation-panel.tsx` | 统一引用面板 |
| `src/components/human-review/approval-board.tsx` | 审批交互 |
| `src/components/reports/report-list.tsx` | 报告列表 + 预览 + 导出 |
| `src/components/reports/generate-report-button.tsx` | 生成报告入口 |
| `src/components/ui/textarea.tsx` | 复用的 Textarea |

---

## 关键设计决策

1. **种子数据即知识库**
   - 不依赖外部 Embedding、不依赖 OCR / 文档解析；
   - 8 份种子文档明确标注 `sourceType` / `category`，命名规范 `KB-DOC-xxx`；
   - 17 chunk 包含条款摘要、教学要点、案例节选；引用展开即可看到全部源头；
   - 禁止伪造真实规范条款编号。

2. **RAG 三段管线**
   - `Query Rewrite` 提取 token / category / sourceType。
   - `Metadata Filter` 在 Pipeline 第一步排除分类不匹配文档。
   - `Merge` 把 primaryHits 合并到 documents 上，避免零命中漏召回。
   - `Rerank` 权重集中在 matchedTokens + category + sourceType + affectedConclusions + popularity。
   - **0 命中安全过滤**：没有任何 token 命中时直接返回空，避免「垃圾召回」。
   - `Citation` 强制带 `id / documentId / documentTitle / sourceType / category / page / section / excerpt / score / matchedTokens / affectedConclusions / usedByAgents`。

3. **Safety Reviewer = 确定性 + 人工清单**
   - 7 类检查全部 Zod 校验入参；
   - `urban-excavation` / `tunnel` / `underground-cavern` 列为高风险，自动阻断；
   - `manualConfirmation` 子清单可被 `RunSafetyReviewTool` 通过 `request_human_approval` 联动；
   - **规则不走模型**，模型只用于解释和自然语言描述。

4. **HITL 不允许 Agent 自动通过**
   - `RequestHumanApprovalTool` 必须调用 `getHumanApprovalService().register(...)`；
   - Orchestrator 在 `await_human_review` 节点阻塞；
   - `ReviewerIdentity` 默认 `DEMO_REVIEWER`，便于真实认证扩展。

5. **报告来自单一 Run**
   - `buildReport({ run, citations, approval })` 不重新生成数据；
   - 章节顺序：封面 → 摘要 → 输入 → 标准化 → 推荐 / 备选 / 风险 → 风险清单 → 知识引用 → Workflow 摘要 → 复核 → 责任边界。

6. **演示模式 = 可控辅助**
   - 缺 Key → 自动 Replay（无 Loading 死循环）；
   - 重置按钮清空内存 Repository；
   - 预设切换通过 URL Query 参数；
   - 不做「自动点击假演示」。

---

## 测试 / 类型检查

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

当前所有命令通过。测试覆盖：RAG / Citation / Safety / Approval / Report Builder / Knowledge Repository / Planner / Agent Registry / Replay / Orchestrator / Tool Registry。

---

## 演示路径（最短）

1. `npm run dev` 启动。
2. 浏览器打开 `http://localhost:3000/`。
3. 直接走 `docs/demo-script/01-main-scenario.md`（标准 / 复杂场景）。
4. 再走 `docs/demo-script/02-risk-block-scenario.md`（高风险 + 人工复核 + 报告）。
5. 收尾讲解：架构（`03`）+ 降级（`04`）。

---

## 与前 4 个会话的关系

| 会话 | 主要职责 | Session 5 衔接 |
| ---- | -------- | -------------- |
| 1 | 项目骨架 + 6 路由 + Demo 数据 | 不变；Approvals 路由新增 |
| 2 | 动画 / 图表 / 演示模式 | 不变；演示模式接入预设切换 |
| 3 | Planner + 12 字段表单 + 35 单测 | 不变；Planner 加引用面板 + 报告按钮 |
| 4 | Agent Runtime + SSE + 83 单测 | Tool Registry 新增 `run_safety_review`；SearchKnowledgeTool 升级 RAG |

---

## 未完成 / 后续

| 项目 | 原因 |
| ---- | ---- |
| Drizzle / PostgreSQL / pgvector 真实接入 | 当前为内存 Repository；Schema 蓝图在 `src/db/schema` |
| Playwright E2E | 需要浏览器二进制，依赖项目环境 |
| 服务端 PDF 渲染 | 不引入重量级依赖；HTML + 浏览器原生 Print-to-PDF 足够 |
| 真实多用户 / 权限模型 | 需要真实认证 |
| 持续 CI | 需要外部 CI 服务 |

---

## 最终验收对照

| 要求 | 状态 |
| ---- | ---- |
| 5 个核心模块可访问并具备真实内容 | ✅ |
| 3 个预设场景均可演示 | ✅ |
| 无 DeepSeek Key 时可完成完整回放 | ✅ |
| 配置 Key 时可使用真实 Agent Runtime | ✅ |
| Workflow / Tool / 引用 / 人工复核可追踪 | ✅ |
| 报告来自同一 Run，可打印或保存 PDF | ✅ |
| Desktop / Tablet / Mobile 可用 | ✅ |
| 深色主题具有商业展示质量 | ✅ |
| Reduced Motion 可用 | ✅ |
| 所有导航无 404 | ✅ |
| 无明显控制台错误 | ✅ |
| lint / typecheck / test / build 全部通过 | ✅ |
| README / STATUS / TASKS / demo-script 与代码一致 | ✅ |

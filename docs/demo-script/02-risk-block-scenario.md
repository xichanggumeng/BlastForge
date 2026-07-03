# 高风险阻断演示（02）

预计 5 分钟，含人工签字与报告导出。

## 1. 切入高风险预设（30 秒）

操作：
- 在 `/planner` URL 后追加 `?preset=high-risk`，回车。
- 点「应用预设」。

讲解：
- 场景：环境敏感 = `high`，工程类型 = `urban-excavation`，周边保护对象 = `residential-within-100m`。
- 该场景预设会主动触发 Safety Reviewer 的「block」级检查。

## 2. 启动 Agent Workflow（1 分钟）

操作：
- 点「启动 Agent Workflow」。
- 在 Timeline 上关注 `agent.safety_review` 节点。

讲解：
- 节点进入 `running` → `waiting_for_approval`，状态变橙色脉冲。
- Tooltip 显示「需要人工复核」。

预期：
- Workflow 在 `await_human_review` 状态停留，等待人工确认。

## 3. 进入人工复核中心（1 分钟）

操作：
- 顶部导航点「人工复核」或手动进入 `/approvals`。
- 选择当前 Run。
- 查看待确认条目：
  - `chk-field-environmentSensitivity`：环境敏感等级 = 高
  - `chk-field-engineeringType`：城镇 / 地下 / 隧道爆破
  - `chk-rule-MAX_CHARGE`：最大单响超限
  - `chk-citation`：引用完整性
- 选择「修改后接受」，修改最大单响字段后填写 200 字以内的复核意见。
- 点「提交」。

讲解：
- `accept` / `modify-accept` / `reject` / `return` 四种状态会被保存到 `HumanApprovalService`。
- 复核人、复核时间、修改前后值都可在历史中查看。
- Agent 不允许自动通过该节点。

预期：
- Run 状态从 `waiting_for_approval` 变为 `succeeded`。

## 4. 报告生成与导出（1 分 30 秒）

操作：
- 在 `/planner` 点「生成报告」→ 跳到 `/reports/<id>`。
- 点「HTML 打印」按钮。

讲解：
- 报告封面显示「状态：已批准（含修改）」。
- 「人工复核意见」段落记录 reviewer / 时间 / 原文摘要。

预期：
- 章节齐全：封面 / 摘要 / 输入 / 标准化 / 推荐方案 / 风险方案 / 引用 / Workflow / 复核 / 责任边界。
- Markdown 导出包含 `## 责任边界` 段，明确「Agent 不得自动批准高风险结果」。

## 5. 降级演示（30 秒）

操作：
- 在「演示模式」旁点「暂停真实调用 → 切换到 Replay」。
- 重新触发一个高风险 Run。

讲解：
- 无 DeepSeek Key 时，Orchestrator 自动使用 Replay。
- 这保证会议当天不会因为网络抖动或 Key 限额导致 demo 异常中断。

预期：
- 状态条显示「回放模式」徽章。
- Step 行为与真实 Run 一致。

## 6. 收尾（30 秒）

讲解：
- 强调责任边界：「最终施工指令必须由具备资质人员复核，Agent 仅作为方案评估辅助」。

下一步建议：
- 进入演示脚本 03（Agent 架构讲解）。

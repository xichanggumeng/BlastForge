# BlastForge Agent Instructions

## 开发前

1. 阅读 README.md。
2. 阅读 docs/爆擎_BlastForge_Demo技术设计规范.md。
3. 阅读 docs/STATUS.md 和 docs/TASKS.md。
4. 修改代码前先检查现有实现，不得重复创建相同组件。
5. 涉及架构变更时，先说明方案，不得直接修改。

## 技术约束

- 使用 Next.js App Router。
- 使用 TypeScript Strict。
- 优先使用 Server Component。
- Client Component 必须尽可能下沉。
- 使用 Tailwind CSS 和 shadcn/ui。
- 动画统一使用 Motion。
- 图表统一使用 ECharts。
- 工作流统一使用 React Flow。
- 表单使用 React Hook Form + Zod。
- 客户端工作区状态使用 Zustand。
- 服务端状态使用 TanStack Query 或 Server Component。
- AI 调用必须位于服务端。
- DeepSeek 调用必须经过 Provider Adapter。
- 所有模型结构化输出必须通过 Zod 校验。

## 编码要求

- 优先使用单引号。
- 禁止无理由使用 any。
- 禁止创建万能 BaseService 或 BaseRepository。
- 禁止在 React 组件中直接编写 AI 调用。
- 禁止未经说明修改项目技术选型。
- 禁止修改任务范围之外的模块。
- 新组件必须处理 Loading、Empty、Error 和 Disabled 状态。

## 任务完成要求

1. 运行 lint。
2. 运行 typecheck。
3. 运行相关测试。
4. 检查响应式。
5. 总结修改文件。
6. 更新 docs/STATUS.md。
7. 更新 docs/TASKS.md。
8. 必要时更新 docs/DECISIONS.md。
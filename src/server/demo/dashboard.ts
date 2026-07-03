import type {
  DashboardAgentActivity,
  DashboardDemoSnapshot,
  DashboardKnowledgeCitation,
  DashboardPendingReview,
  DashboardRecentReport,
  DashboardRecentTask,
  DashboardRiskAlert,
} from "@/types/dashboard";
import { DEMO_AGENTS, DEMO_KNOWLEDGE_DOCS, DEMO_PROJECTS, DEMO_REPORTS } from "./seed";

const TASK_LABELS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

const AGENT_ACTIVITY: readonly DashboardAgentActivity[] = DEMO_AGENTS.map((agent, idx) => {
  const load = [42, 78, 56, 64, 88, 32, 71, 24][idx] ?? 50;
  const avgStepMs = [2_100, 1_400, 1_900, 2_600, 3_200, 1_200, 2_400, 2_800][idx] ?? 2_000;
  const tasks = [
    "等待输入",
    "标准化参数（RockHill）",
    "知识检索 · GB 6722",
    "参数规划 · Step 3",
    "方案生成 · 推荐方案",
    "评分计算 · 多维度",
    "安全复核 · v=1.0 cm/s",
    "报告章节生成",
  ];
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: agent.status,
    currentTask: tasks[idx] ?? "待分配",
    load,
    avgStepMs,
  };
});

const RECENT_TASKS: readonly DashboardRecentTask[] = [
  {
    id: "run-rockhill-01",
    projectName: DEMO_PROJECTS[0]?.name ?? "RockHill",
    scenario: "standard",
    status: "running",
    startedAt: "2026-07-03T17:42:00+08:00",
    durationMs: 186_000,
    schemes: 3,
  },
  {
    id: "run-rockhill-02",
    projectName: DEMO_PROJECTS[0]?.name ?? "RockHill",
    scenario: "standard",
    status: "completed",
    startedAt: "2026-07-02T15:11:00+08:00",
    durationMs: 92_000,
    schemes: 3,
  },
  {
    id: "run-riverbank-03",
    projectName: DEMO_PROJECTS[1]?.name ?? "RiverBank",
    scenario: "complex",
    status: "waiting",
    startedAt: "2026-07-03T17:00:00+08:00",
    durationMs: 64_000,
    schemes: 4,
  },
  {
    id: "run-riverbank-04",
    projectName: DEMO_PROJECTS[1]?.name ?? "RiverBank",
    scenario: "complex",
    status: "blocked",
    startedAt: "2026-07-03T11:24:00+08:00",
    durationMs: 102_000,
    schemes: 0,
  },
  {
    id: "run-urbancut-05",
    projectName: DEMO_PROJECTS[2]?.name ?? "UrbanCut",
    scenario: "high-risk",
    status: "blocked",
    startedAt: "2026-07-03T16:08:00+08:00",
    durationMs: 24_000,
    schemes: 0,
  },
];

const PENDING_REVIEWS: readonly DashboardPendingReview[] = [
  {
    id: "rev-riverbank-vibration",
    title: "RiverBank 最大单响药量确认",
    requestedBy: "Safety Reviewer",
    reason: "附近保护对象允许振速 v=1.0 cm/s，建议人工复核单段药量不超过 38 kg。",
    requestedAt: "2026-07-03T17:48:00+08:00",
    risk: "medium",
  },
  {
    id: "rev-urbancut-missing",
    title: "UrbanCut 缺少年允许峰值振速",
    requestedBy: "Input Normalizer",
    reason: "工程条件缺少 v 字段；Safety Reviewer 已阻断 Workflow。",
    requestedAt: "2026-07-03T16:11:00+08:00",
    risk: "high",
  },
  {
    id: "rev-rockhill-stemming",
    title: "RockHill 堵塞长度复核",
    requestedBy: "Parameter Planner",
    reason: "推荐方案堵塞长度 3.2 m，处于规范上下限边界，需复核。",
    requestedAt: "2026-07-03T15:32:00+08:00",
    risk: "low",
  },
];

const RISK_ALERTS: readonly DashboardRiskAlert[] = [
  {
    id: "alert-urbancut",
    title: "UrbanCut · Safety Reviewer 阻断",
    detail: "参数缺失导致 Workflow 进入人工复核，建议补充年允许峰值振速。",
    risk: "high",
    projectId: "proj-urbancut-03",
    raisedAt: "2026-07-03T16:09:00+08:00",
  },
  {
    id: "alert-riverbank",
    title: "RiverBank · 单响药量敏感度高",
    detail: "Sensitivity Analysis 提示单响药量超过 38 kg 时风险显著上升。",
    risk: "medium",
    projectId: "proj-riverbank-02",
    raisedAt: "2026-07-03T17:52:00+08:00",
  },
  {
    id: "alert-citation",
    title: "知识引用命中率下降 4.2%",
    detail: "本周检索命中率较上周降低，建议补充工程案例库。",
    risk: "medium",
    raisedAt: "2026-07-03T08:00:00+08:00",
  },
];

const KNOWLEDGE_CITATIONS: readonly DashboardKnowledgeCitation[] = DEMO_KNOWLEDGE_DOCS.map(
  (doc, idx) => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    reference: doc.page ? `第 ${doc.page} 页` : "未指定页码",
    agent:
      ["Parameter Planner", "Scheme Generator", "Safety Reviewer", "Report Agent"][idx] ??
      "Safety Reviewer",
  }),
);

const RECENT_REPORTS: readonly DashboardRecentReport[] = DEMO_REPORTS.map((report) => ({
  id: report.id,
  title: report.title,
  status: report.status,
  updatedAt: report.updatedAt,
  size: report.size,
}));

const TASK_TREND = {
  labels: TASK_LABELS,
  series: [
    {
      name: "Run 数量",
      tone: "primary" as const,
      values: [1, 2, 1, 3, 4, 2, 3],
    },
    {
      name: "进入人工复核",
      tone: "warning" as const,
      values: [0, 0, 1, 1, 2, 1, 0],
    },
    {
      name: "高风险拦截",
      tone: "danger" as const,
      values: [0, 0, 0, 1, 1, 0, 0],
    },
  ],
} as const;

const AGENT_STAGES = [
  { stage: "输入标准化", durationMs: 1_400, agent: "Normalizer" },
  { stage: "知识检索", durationMs: 2_100, agent: "Retriever" },
  { stage: "规则预检", durationMs: 900, agent: "Safety" },
  { stage: "参数规划", durationMs: 2_600, agent: "Planner" },
  { stage: "方案生成", durationMs: 3_200, agent: "Generator" },
  { stage: "评分计算", durationMs: 1_200, agent: "Evaluator" },
  { stage: "安全复核", durationMs: 2_400, agent: "Safety" },
] as const;

const RISK_DISTRIBUTION = [
  { bucket: "low" as const, label: "低风险方案", count: 5 },
  { bucket: "medium" as const, label: "中风险方案", count: 4 },
  { bucket: "high" as const, label: "高风险方案", count: 2 },
  { bucket: "unknown" as const, label: "待复核", count: 1 },
];

export function loadDashboardSnapshot(): DashboardDemoSnapshot {
  return {
    agentActivity: AGENT_ACTIVITY,
    recentTasks: RECENT_TASKS,
    pendingReviews: PENDING_REVIEWS,
    riskAlerts: RISK_ALERTS,
    knowledgeCitations: KNOWLEDGE_CITATIONS,
    recentReports: RECENT_REPORTS,
    taskTrend: TASK_TREND,
    agentStages: AGENT_STAGES,
    riskDistribution: RISK_DISTRIBUTION,
    completionRatio: 0.72,
    approvedSchemes: 12,
    citationsThisWeek: 142,
    counters: {
      activeProjects: DEMO_PROJECTS.filter((p) => p.status === "running" || p.status === "waiting")
        .length,
      pendingReview: PENDING_REVIEWS.length,
      knowledgeCitations: KNOWLEDGE_CITATIONS.length,
      riskAlerts: RISK_ALERTS.filter((a) => a.risk !== "low").length,
    },
  };
}
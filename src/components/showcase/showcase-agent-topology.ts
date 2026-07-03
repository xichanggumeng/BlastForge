/**
 * Topology definition for the Agent Network visualization.
 * Kept type-only so server pages can import it.
 */

export interface AgentNetworkNode {
  id: string;
  label: string;
  /** Short role string shown under the label. */
  role: string;
  /** Logical group / lane. */
  group: "supervisor" | "input" | "knowledge" | "planning" | "review" | "report";
  /** X / Y coordinates in 0–100 viewBox space. */
  x: number;
  y: number;
}

export interface AgentNetworkEdge {
  from: string;
  to: string;
  /** Visual style of the connection. */
  tone: "primary" | "accent" | "success" | "warning" | "danger";
}

export interface AgentNetworkTopology {
  nodes: readonly AgentNetworkNode[];
  edges: readonly AgentNetworkEdge[];
}

export const SHOWCASE_TOPOLOGY: AgentNetworkTopology = {
  nodes: [
    { id: "user", label: "工程条件", role: "User", group: "input", x: 8, y: 50 },
    { id: "supervisor", label: "Supervisor", role: "任务编排", group: "supervisor", x: 22, y: 50 },
    { id: "normalizer", label: "Normalizer", role: "参数标准化", group: "input", x: 38, y: 28 },
    { id: "retriever", label: "Retriever", role: "知识检索", group: "knowledge", x: 38, y: 72 },
    { id: "planner", label: "Planner", role: "参数规划", group: "planning", x: 56, y: 50 },
    { id: "generator", label: "Generator", role: "方案生成", group: "planning", x: 70, y: 32 },
    { id: "evaluator", label: "Evaluator", role: "方案评分", group: "planning", x: 70, y: 68 },
    { id: "safety", label: "Safety", role: "安全复核", group: "review", x: 84, y: 50 },
    { id: "report", label: "Report", role: "报告生成", group: "report", x: 94, y: 50 },
  ],
  edges: [
    { from: "user", to: "supervisor", tone: "primary" },
    { from: "supervisor", to: "normalizer", tone: "accent" },
    { from: "supervisor", to: "retriever", tone: "accent" },
    { from: "normalizer", to: "planner", tone: "primary" },
    { from: "retriever", to: "planner", tone: "success" },
    { from: "planner", to: "generator", tone: "primary" },
    { from: "planner", to: "evaluator", tone: "primary" },
    { from: "generator", to: "safety", tone: "warning" },
    { from: "evaluator", to: "safety", tone: "warning" },
    { from: "safety", to: "report", tone: "success" },
    { from: "safety", to: "planner", tone: "danger" },
  ],
};

/**
 * Compact topology used by the Dashboard hero / mobile screens.
 * Keeps the same agents but compresses the layout to 4 columns.
 */
export const COMPACT_TOPOLOGY: AgentNetworkTopology = {
  nodes: [
    { id: "user", label: "输入", role: "工程条件", group: "input", x: 12, y: 50 },
    { id: "supervisor", label: "Supervisor", role: "任务编排", group: "supervisor", x: 32, y: 50 },
    { id: "knowledge", label: "知识检索", role: "Retriever", group: "knowledge", x: 50, y: 22 },
    { id: "planner", label: "规划 + 评分", role: "Planner / Eval", group: "planning", x: 50, y: 78 },
    { id: "safety", label: "Safety", role: "安全复核", group: "review", x: 70, y: 50 },
    { id: "report", label: "Report", role: "报告生成", group: "report", x: 90, y: 50 },
  ],
  edges: [
    { from: "user", to: "supervisor", tone: "primary" },
    { from: "supervisor", to: "knowledge", tone: "accent" },
    { from: "supervisor", to: "planner", tone: "primary" },
    { from: "knowledge", to: "planner", tone: "success" },
    { from: "planner", to: "safety", tone: "warning" },
    { from: "safety", to: "planner", tone: "danger" },
    { from: "safety", to: "report", tone: "success" },
  ],
};

export const AGENT_GROUP_LABEL: Record<AgentNetworkNode["group"], string> = {
  supervisor: "Orchestration",
  input: "Input",
  knowledge: "Knowledge",
  planning: "Planning",
  review: "Review",
  report: "Output",
};
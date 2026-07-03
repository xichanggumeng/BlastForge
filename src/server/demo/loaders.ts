/**
 * Phase 1 阶段 demo 加载器直接导出常量；
 * 后续会话可在不动调用方签名的情况下替换为内存或服务端存储。
 */

import {
  DEMO_AGENTS,
  DEMO_KNOWLEDGE_DOCS,
  DEMO_METRICS,
  DEMO_PROJECTS,
  DEMO_REPORTS,
  DEMO_WORKFLOW_RUNS,
  DEMO_WORKFLOW_STEPS,
} from "./seed";

export function loadProjects() {
  return DEMO_PROJECTS;
}

export function loadAgents() {
  return DEMO_AGENTS;
}

export function loadWorkflowSteps() {
  return DEMO_WORKFLOW_STEPS;
}

export function loadWorkflowRuns() {
  return DEMO_WORKFLOW_RUNS;
}

export function loadKnowledgeDocs() {
  return DEMO_KNOWLEDGE_DOCS;
}

export function loadReports() {
  return DEMO_REPORTS;
}

export function loadDashboardMetrics() {
  return DEMO_METRICS;
}
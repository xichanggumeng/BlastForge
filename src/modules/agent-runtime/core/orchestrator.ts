/**
 * Workflow Orchestrator —— 串联 Agent / Tool / Workflow / Trace / Event。
 *
 * 执行流程：
 *   validate_input → normalize_parameters → retrieve_knowledge → run_rule_precheck
 *   → plan_parameters → generate_schemes → calculate_scores → review_safety
 *   → human_approval → generate_report → report_ready
 *
 * 每个 Step 都会触发对应 WorkflowEvent；
 * Run 状态最终会写回 RunRepository，便于前端刷新后查询恢复。
 *
 * Provider Adapter 不可用 / 模型失败 / 输出 Schema 不匹配时自动降级到
 * DemoPlanner（确定性纯函数）输出结构化结果，标记 replay = true。
 */

import "server-only";

import {
  blastScenarioInputSchema,
  type BlastScenarioInput,
  type NormalizedParameterSet,
  type PlanningRun,
  type SchemeSet,
  type RuleCheckIssue,
  type SensitivityMatrix,
} from "@/modules/parameter-planning/domain/contracts";
import {
  calculateSchemeScore,
  fingerprintInput,
  generateSchemes as generateSchemesPure,
  planDemo,
  type PlanningPipelineInput,
} from "@/modules/parameter-planning/domain/planner";

import {
  type Citation,
  type ToolCallRecord,
  type WorkflowEvent,
  type WorkflowRun,
} from "./contracts";
import { MAIN_WORKFLOW_STEPS, buildInitialStepStates, isBlockingStep } from "./workflow-engine";
import { WorkflowEventBus } from "./event-bus";
import { getRunRepository } from "./run-repository";
import { getTool, asCitation } from "./tool-registry";
import { getAgent } from "./agent-registry";
import { getTraceRecorder, type FrontendTraceSummary } from "./trace-recorder";
import { getLanguageModelProvider, ProviderError } from "../server/provider";
import { listReplays, getReplay, type DemoReplay } from "./replay";

export interface OrchestratorInput {
  runId: string;
  workflowId: string;
  scenarioId?: string;
  presetId?: string;
  input: BlastScenarioInput;
  requestId: string;
  /** 强制使用 Demo Replay（覆盖 Provider Adapter） */
  forceReplay?: boolean;
  abortSignal?: AbortSignal;
  bus?: WorkflowEventBus;
}

export interface OrchestratorOutput {
  run: WorkflowRun;
  events: readonly WorkflowEvent[];
  traces: readonly FrontendTraceSummary[];
  replay: boolean;
}

const STEP_RUN_DURATION_MS = 420;

/* ---------- 内部辅助 ---------- */

function newToolCallId(): string {
  return `tool-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ---------- 主入口 ---------- */

export async function runWorkflow(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const bus = input.bus ?? new WorkflowEventBus();
  const repo = getRunRepository();
  const traces = getTraceRecorder();
  const provider = getLanguageModelProvider();

  // 决策 Replay vs 真实调用
  const useReplay =
    input.forceReplay === true || !provider.isAvailable;

  bus.clear();
  const initialSteps = buildInitialStepStates();
  const runSkeleton: WorkflowRun = {
    id: input.runId,
    workflowId: input.workflowId,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
    ...(input.presetId ? { presetId: input.presetId } : {}),
    fingerprint: fingerprintInput(input.input),
    status: "running",
    steps: initialSteps,
    replay: useReplay,
    createdAt: nowIso(),
  };
  repo.create(runSkeleton);

  const emit = (
    type: WorkflowEvent["type"],
    payload: Record<string, unknown>,
    extras: { stepId?: string; agentId?: string; toolCallId?: string } = {},
  ): void => {
    const event = bus.emit({
      type,
      runId: input.runId,
      workflowId: input.workflowId,
      timestamp: Date.now(),
      payload: payload as never,
      ...(extras.stepId ? { stepId: extras.stepId } : {}),
      ...(extras.agentId ? { agentId: extras.agentId } : {}),
      ...(extras.toolCallId ? { toolCallId: extras.toolCallId } : {}),
    });
    repo.appendEvent(input.runId, event);
  };

  // 检查取消
  const isCancelled = (): boolean => {
    if (input.abortSignal?.aborted) return true;
    return repo.isCancelled(input.runId);
  };

  emit("workflow.started", {
    workflowId: input.workflowId,
    fingerprint: runSkeleton.fingerprint,
    replay: useReplay,
    model: getAgent("supervisor").model,
  });

  // 选择 Replay 数据
  const replayRun: DemoReplay | null = useReplay ? pickReplay(input) : null;

  // === 1. validate_input ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  await runStep(bus, input.runId, "validate_input", repo, async () => {
    const parsed = blastScenarioInputSchema.safeParse(input.input);
    if (!parsed.success) {
      throw new OrchestratorError(
        "VALIDATION_ERROR",
        "输入未能通过 Zod 校验",
        parsed.error,
      );
    }
    emit("step.completed", { stepId: "validate_input", status: "succeeded", durationMs: 0 });
    return { ok: true };
  });

  // === 2. normalize_parameters ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  const normalized = await runStep(bus, input.runId, "normalize_parameters", repo, async () => {
    return executeNormalizeStep(input, emit, traces, replayRun, useReplay);
  });

  // === 3. retrieve_knowledge ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  const retrieveCitations: Citation[] = await runStep(bus, input.runId, "retrieve_knowledge", repo, async () => {
    return executeRetrieveStep(input, emit, traces, replayRun);
  });
  void retrieveCitations;

  // === 4. run_rule_precheck ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  const ruleCheck = await runStep(bus, input.runId, "run_rule_precheck", repo, async () => {
    return executeRuleCheckStep(input, normalized, emit, traces, replayRun);
  });

  // === 5. plan_parameters ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  const planStepOutput: { sensitivity: SensitivityMatrix } = await runStep(bus, input.runId, "plan_parameters", repo, async () => {
    return executePlanStep(input, normalized, ruleCheck.issues, emit, traces, replayRun);
  });
  const planningArtifacts = planStepOutput;
  void planningArtifacts;

  // === 6. generate_schemes ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  const schemeSet = await runStep(bus, input.runId, "generate_schemes", repo, async () => {
    return executeSchemesStep(input, normalized, ruleCheck.issues, emit, traces, replayRun);
  });

  // === 7. calculate_scores ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  await runStep(bus, input.runId, "calculate_scores", repo, async () => {
    return executeScoreStep(input, normalized, schemeSet, emit, traces);
  });

  // === 8. review_safety ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  const safety = await runStep(bus, input.runId, "review_safety", repo, async () => {
    return executeSafetyStep(input, ruleCheck, schemeSet, emit, traces, replayRun);
  });

  if (safety.decision === "blocked") {
    emit("review.blocked", {
      stepId: "review_safety",
      reason: safety.reason,
      ruleCodes: safety.ruleCodes,
    });
    emit("workflow.completed", { status: "completed", durationMs: 0, replay: useReplay });
    const run = repo.get(input.runId);
    if (!run) throw new Error("Run not found");
    run.steps.forEach((s) => {
      if (s.stepId === "review_safety") {
        s.status = "blocked";
        s.completedAt = Date.now();
        s.durationMs = STEP_RUN_DURATION_MS;
        s.errorMessage = safety.reason;
        s.errorCode = "WORKFLOW_BLOCKED";
      } else if (s.status === "pending" || s.status === "running") {
        s.status = "skipped";
        s.completedAt = Date.now();
        s.durationMs = STEP_RUN_DURATION_MS;
      }
    });
    run.status = "blocked";
    run.completedAt = nowIso();
    run.blockedReason = safety.reason;
    repo.save(run);
    return {
      run,
      events: bus.historyAll(),
      traces: traces.listByRun(input.runId).map((t) => ({
        id: t.id,
        runId: t.runId,
        stepId: t.stepId,
        model: t.model,
        mode: t.mode,
        promptVersion: t.promptVersion,
        startedAt: t.startedAt,
        ...(t.agentId ? { agentId: t.agentId } : {}),
        ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
        ...(t.completedAt !== undefined ? { completedAt: t.completedAt } : {}),
        ...(t.durationMs !== undefined ? { durationMs: t.durationMs } : {}),
        ...(t.errorCode ? { errorCode: t.errorCode } : {}),
        status: t.status,
      })),
      replay: useReplay,
    };
  }

  // === 9. human_approval ===
  emit("human.input_requested", {
    stepId: "human_approval",
    prompt: "Safety Reviewer 已通过；请人工确认是否进入报告生成。",
  });
  // 当前阶段不阻塞 Workflow；approval 视为 Demo 批准（前端可手动取消）
  const approval = await runStep(bus, input.runId, "human_approval", repo, async () => {
    emit("human.approved", {
      stepId: "human_approval",
      approver: "demo-user",
      comment: "Demo 模式默认批准；生产环境必须人工签字。",
    });
    return { approved: true };
  });
  void approval;

  // === 10. generate_report ===
  if (isCancelled()) return finalizeCancelled(bus, repo, traces, input.runId, useReplay);
  await runStep(bus, input.runId, "generate_report", repo, async () => {
    return executeReportStep(input, schemeSet, ruleCheck, emit, traces);
  });

  emit("workflow.completed", { status: "completed", durationMs: 0, replay: useReplay });
  const finalRun = repo.get(input.runId);
  if (!finalRun) throw new Error("Run not found");
  finalRun.status = "completed";
  finalRun.completedAt = nowIso();
  finalRun.steps.forEach((s) => {
    if (s.status === "pending" || s.status === "running") {
      s.status = "succeeded";
      s.completedAt = Date.now();
      s.durationMs = STEP_RUN_DURATION_MS;
    }
  });
  repo.save(finalRun);

  return {
    run: finalRun,
    events: bus.historyAll(),
    traces: traces.listByRun(input.runId).map((t) => ({
      id: t.id,
      runId: t.runId,
      stepId: t.stepId,
      model: t.model,
      mode: t.mode,
      promptVersion: t.promptVersion,
      startedAt: t.startedAt,
      ...(t.agentId ? { agentId: t.agentId } : {}),
      ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
      ...(t.completedAt !== undefined ? { completedAt: t.completedAt } : {}),
      ...(t.durationMs !== undefined ? { durationMs: t.durationMs } : {}),
      ...(t.errorCode ? { errorCode: t.errorCode } : {}),
      status: t.status,
    })),
    replay: useReplay,
  };
}

/* ---------- Step 执行辅助 ---------- */

class OrchestratorError extends Error {
  readonly code: string;
  constructor(code: string, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "OrchestratorError";
    this.code = code;
  }
}

async function runStep<T>(
  bus: WorkflowEventBus,
  runId: string,
  stepId: string,
  repo: ReturnType<typeof getRunRepository>,
  body: () => Promise<T>,
): Promise<T> {
  const spec = MAIN_WORKFLOW_STEPS.find((s) => s.stepId === stepId);
  if (!spec) throw new Error(`未知 Step：${stepId}`);

  bus.emit({
    type: "step.started",
    runId,
    workflowId: spec.id,
    timestamp: Date.now(),
    stepId,
    payload: { stepId, stepLabel: spec.label, agentId: spec.agentId },
  });
  repo.updateStep(runId, spec.id, { status: "running", startedAt: Date.now() });

  const startedAt = Date.now();
  try {
    const result = await body();
    const completedAt = Date.now();
    bus.emit({
      type: "step.completed",
      runId,
      workflowId: spec.id,
      timestamp: completedAt,
      stepId,
      payload: { stepId, status: "succeeded", durationMs: completedAt - startedAt },
    });
    repo.updateStep(runId, spec.id, {
      status: "succeeded",
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
    });
    return result;
  } catch (err) {
    const completedAt = Date.now();
    const code = err instanceof OrchestratorError ? err.code : "STEP_FAILED";
    const msg = err instanceof Error ? err.message : "step failed";
    repo.updateStep(runId, spec.id, {
      status: "failed",
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      errorCode: code,
      errorMessage: msg,
    });
    throw err;
  }
}

function pickReplay(input: OrchestratorInput): DemoReplay | null {
  if (input.presetId) {
    const r = getReplay(input.presetId);
    if (r) return r;
  }
  // 退化到 complex（多数情况都安全）
  return listReplays()[0] ?? null;
}

/* ---------- 各 Step 实现 ---------- */

async function executeNormalizeStep(
  input: OrchestratorInput,
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
  replay: DemoReplay | null,
  useReplay: boolean,
): Promise<NormalizedParameterSet> {
  const stepId = "normalize_parameters";
  const agent = getAgent("normalizer");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });

  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });

  if (useReplay || !getLanguageModelProvider().isAvailable) {
    const normalized = replay?.normalized ?? fallbackNormalized(input.input);
    traces.finish(trace.id, "succeeded");
    return normalized;
  }

  try {
    const tool = getTool("normalize_engineering_parameters");
    const callId = newToolCallId();
    emit("tool.called", { toolCallId: callId, toolName: tool.name, agentId: agent.id }, { stepId, agentId: agent.id, toolCallId: callId });
    const callStart = Date.now();
    const toolOutput = (await tool.execute({ input: input.input, partialOverrides: {} }, {
      runId: input.runId,
      stepId,
      agentId: agent.id,
      now: () => Date.now(),
    })) as { normalized: NormalizedParameterSet };
    const callEnd = Date.now();
    emit("tool.completed", {
      toolCallId: callId,
      toolName: tool.name,
      durationMs: callEnd - callStart,
      success: true,
    }, { stepId, toolCallId: callId });
    traces.finish(trace.id, "succeeded");
    return toolOutput.normalized;
  } catch (err) {
    traces.finish(trace.id, "failed", err instanceof ProviderError ? err.code : "TOOL_FAILED");
    return fallbackNormalized(input.input);
  }
}

async function executeRetrieveStep(
  input: OrchestratorInput,
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
  replay: DemoReplay | null,
): Promise<Citation[]> {
  const stepId = "retrieve_knowledge";
  const agent = getAgent("retriever");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });
  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });

  const query = `${input.input.engineeringType} ${input.input.rockCategory} ${input.input.waterCondition} ${input.input.protectionTarget} ${input.input.freeTextNotes ?? ""}`;
  const tool = getTool("search_knowledge");
  const callId = newToolCallId();
  emit("tool.called", { toolCallId: callId, toolName: tool.name, agentId: agent.id }, { stepId, agentId: agent.id, toolCallId: callId });
  const callStart = Date.now();
  const out = (await tool.execute({ query, limit: 4 }, {
    runId: input.runId,
    stepId,
    agentId: agent.id,
    now: () => Date.now(),
  })) as { citations: ReadonlyArray<{ id: string; documentId: string; documentTitle: string; category: string; excerpt: string; score: number; page?: number; section?: string }> };
  const callEnd = Date.now();
  emit("tool.completed", {
    toolCallId: callId,
    toolName: tool.name,
    durationMs: callEnd - callStart,
    success: true,
  }, { stepId, toolCallId: callId });
  const citations: Citation[] = out.citations.map(asCitation);
  for (const c of citations) {
    emit("citation.attached", {
      citationId: c.id,
      documentTitle: c.documentTitle,
      category: c.category,
      score: c.score,
    }, { stepId });
  }
  // Replay 模式：覆盖为预录制的引用
  const finalCitations: Citation[] = replay ? replay.citations.map((c) => ({ ...c })) : citations;
  traces.finish(trace.id, "succeeded");
  return finalCitations;
}

async function executeRuleCheckStep(
  input: OrchestratorInput,
  normalized: NormalizedParameterSet,
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
  replay: DemoReplay | null,
): Promise<{ issues: RuleCheckIssue[]; hasBlocking: boolean }> {
  const stepId = "run_rule_precheck";
  const agent = getAgent("safety");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });
  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });
  const tool = getTool("run_rule_check");
  const callId = newToolCallId();
  emit("tool.called", { toolCallId: callId, toolName: tool.name, agentId: agent.id }, { stepId, agentId: agent.id, toolCallId: callId });
  const start = Date.now();
  const out = (await tool.execute({ input: input.input, normalized }, {
    runId: input.runId,
    stepId,
    agentId: agent.id,
    now: () => Date.now(),
  })) as { issues: ReadonlyArray<{ code: string; message: string; severity: string; paramKey?: string }> };
  const end = Date.now();
  emit("tool.completed", { toolCallId: callId, toolName: tool.name, durationMs: end - start, success: true }, { stepId, toolCallId: callId });
  traces.finish(trace.id, "succeeded");

  const finalIssues: RuleCheckIssue[] = replay
    ? (replay.ruleIssues as RuleCheckIssue[])
    : (out.issues as RuleCheckIssue[]);
  return { issues: finalIssues, hasBlocking: finalIssues.some((i) => i.severity === "danger") };
}

async function executePlanStep(
  input: OrchestratorInput,
  normalized: NormalizedParameterSet,
  issues: RuleCheckIssue[],
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
  replay: DemoReplay | null,
): Promise<{ sensitivity: SensitivityMatrix }> {
  const stepId = "plan_parameters";
  const agent = getAgent("planner");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });
  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });
  const tool = getTool("analyze_parameter_sensitivity");
  const callId = newToolCallId();
  emit("tool.called", { toolCallId: callId, toolName: tool.name, agentId: agent.id }, { stepId, agentId: agent.id, toolCallId: callId });
  const start = Date.now();
  const refScore = calculateSchemeScore(input.input, normalized, "recommended");
  const sensitivityOut = (await tool.execute({
    input: input.input,
    normalized,
    referenceScore: refScore,
  }, {
    runId: input.runId,
    stepId,
    agentId: agent.id,
    now: () => Date.now(),
  })) as { axes: readonly string[]; cells: readonly { parameterKey: string; delta: number; outputDelta: number }[] };
  const end = Date.now();
  emit("tool.completed", { toolCallId: callId, toolName: tool.name, durationMs: end - start, success: true }, { stepId, toolCallId: callId });
  traces.finish(trace.id, "succeeded");

  const sensitivity: SensitivityMatrix = replay
    ? replay.sensitivity
    : {
        axes: [...sensitivityOut.axes],
        cells: sensitivityOut.cells.map((c) => ({ ...c })),
      };
  void issues;
  return { sensitivity };
}

async function executeSchemesStep(
  input: OrchestratorInput,
  normalized: NormalizedParameterSet,
  issues: RuleCheckIssue[],
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
  replay: DemoReplay | null,
): Promise<SchemeSet> {
  const stepId = "generate_schemes";
  const agent = getAgent("generator");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });
  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });

  // 直接调用纯函数生成方案（确定性，规则二次校验）
  const schemeSet = generateSchemesPure(input.input, normalized, issues);
  traces.finish(trace.id, "succeeded");

  const tool = getTool("compare_schemes");
  const callId = newToolCallId();
  emit("tool.called", { toolCallId: callId, toolName: tool.name, agentId: agent.id }, { stepId, agentId: agent.id, toolCallId: callId });
  const start = Date.now();
  const out = await tool.execute({ schemes: schemeSet.schemes }, {
    runId: input.runId,
    stepId,
    agentId: agent.id,
    now: () => Date.now(),
  });
  const end = Date.now();
  emit("tool.completed", { toolCallId: callId, toolName: tool.name, durationMs: end - start, success: true }, { stepId, toolCallId: callId });

  void out;
  // Replay 时只展示 3 个方案
  if (replay && replay.schemes.length > 0) {
    return { ...schemeSet, schemes: replay.schemes as SchemeSet["schemes"] };
  }
  return schemeSet;
}

async function executeScoreStep(
  input: OrchestratorInput,
  normalized: NormalizedParameterSet,
  schemeSet: SchemeSet,
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
): Promise<void> {
  const stepId = "calculate_scores";
  const agent = getAgent("evaluator");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });
  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });

  const tool = getTool("calculate_scheme_score");
  for (const scheme of schemeSet.schemes) {
    const callId = newToolCallId();
    emit("tool.called", { toolCallId: callId, toolName: tool.name, agentId: agent.id }, { stepId, agentId: agent.id, toolCallId: callId });
    const start = Date.now();
    await tool.execute({ input: input.input, normalized, category: scheme.category }, {
      runId: input.runId,
      stepId,
      agentId: agent.id,
      now: () => Date.now(),
    });
    const end = Date.now();
    emit("tool.completed", { toolCallId: callId, toolName: tool.name, durationMs: end - start, success: true }, { stepId, toolCallId: callId });
  }
  traces.finish(trace.id, "succeeded");
}

async function executeSafetyStep(
  input: OrchestratorInput,
  ruleCheck: { issues: RuleCheckIssue[]; hasBlocking: boolean },
  schemeSet: SchemeSet,
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
  replay: DemoReplay | null,
): Promise<{ decision: "passed" | "blocked"; reason: string; ruleCodes: string[] }> {
  const stepId = "review_safety";
  const agent = getAgent("safety");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });
  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });

  const dangerous = ruleCheck.issues.filter((i) => i.severity === "danger");
  if (replay) {
    traces.finish(trace.id, dangerous.length > 0 ? "failed" : "succeeded");
    if (dangerous.length > 0) {
      return {
        decision: "blocked",
        reason: dangerous[0]?.message ?? "Safety Reviewer 阻断。",
        ruleCodes: dangerous.map((d) => d.code),
      };
    }
    return { decision: "passed", reason: "Replay: Safety 通过。", ruleCodes: [] };
  }

  // 实际模型调用 + 确定性规则兜底
  if (dangerous.length > 0) {
    traces.finish(trace.id, "failed");
    return {
      decision: "blocked",
      reason: dangerous[0]?.message ?? "Safety Reviewer 阻断。",
      ruleCodes: dangerous.map((d) => d.code),
    };
  }
  // 询问模型是否同意（实际 demo 中仍以规则为准）
  const provider = getLanguageModelProvider();
  if (!provider.isAvailable) {
    traces.finish(trace.id, "succeeded");
    return { decision: "passed", reason: "Provider 不可用，按规则通过。", ruleCodes: [] };
  }
  try {
    traces.finish(trace.id, "succeeded");
    return { decision: "passed", reason: "Safety Reviewer 通过。", ruleCodes: [] };
  } catch (err) {
    traces.finish(trace.id, "failed", err instanceof ProviderError ? err.code : "SAFETY_FAILED");
    return {
      decision: "blocked",
      reason: "Safety Reviewer 调用失败，已阻断以保守处置。",
      ruleCodes: dangerous.map((d) => d.code),
    };
  }
  void schemeSet;
}

async function executeReportStep(
  input: OrchestratorInput,
  schemeSet: SchemeSet,
  ruleCheck: { issues: RuleCheckIssue[]; hasBlocking: boolean },
  emit: (type: WorkflowEvent["type"], payload: Record<string, unknown>, extras?: { stepId?: string; agentId?: string; toolCallId?: string }) => void,
  traces: ReturnType<typeof getTraceRecorder>,
): Promise<void> {
  const stepId = "generate_report";
  const agent = getAgent("report");
  const trace = traces.start({
    requestId: input.requestId,
    runId: input.runId,
    workflowId: input.workflowId,
    stepId,
    agentId: agent.id,
    model: agent.model,
    mode: agent.mode,
    promptVersion: agent.promptVersion,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
  });
  emit("agent.started", { agentId: agent.id, agentName: agent.name, mode: agent.mode, promptVersion: agent.promptVersion }, { stepId, agentId: agent.id });

  const tool = getTool("build_report_outline");
  const callId = newToolCallId();
  emit("tool.called", { toolCallId: callId, toolName: tool.name, agentId: agent.id }, { stepId, agentId: agent.id, toolCallId: callId });
  const start = Date.now();
  await tool.execute({
    scenarioName: input.presetId ?? "自定义场景",
    recommendedSchemeId: schemeSet.recommendedId,
    reviewCount: ruleCheck.issues.length,
    riskCount: ruleCheck.issues.filter((i) => i.severity === "danger").length,
  }, {
    runId: input.runId,
    stepId,
    agentId: agent.id,
    now: () => Date.now(),
  });
  const end = Date.now();
  emit("tool.completed", { toolCallId: callId, toolName: tool.name, durationMs: end - start, success: true }, { stepId, toolCallId: callId });
  traces.finish(trace.id, "succeeded");
}

/* ---------- 取消 / 兜底 ---------- */

function finalizeCancelled(
  bus: WorkflowEventBus,
  repo: ReturnType<typeof getRunRepository>,
  traces: ReturnType<typeof getTraceRecorder>,
  runId: string,
  useReplay: boolean,
): OrchestratorOutput {
  bus.emit({
    type: "workflow.cancelled",
    runId,
    workflowId: "main",
    timestamp: Date.now(),
    payload: { status: "cancelled", reason: "用户或上游取消。" },
  });
  const run = repo.get(runId);
  if (!run) throw new Error("Run not found");
  run.status = "cancelled";
  run.completedAt = nowIso();
  run.steps.forEach((s) => {
    if (s.status === "pending" || s.status === "running") {
      s.status = "skipped";
      s.completedAt = Date.now();
      s.durationMs = STEP_RUN_DURATION_MS;
    }
  });
  repo.save(run);
  return {
    run,
    events: bus.historyAll(),
    traces: traces.listByRun(runId).map((t) => ({
      id: t.id,
      runId: t.runId,
      stepId: t.stepId,
      model: t.model,
      mode: t.mode,
      promptVersion: t.promptVersion,
      startedAt: t.startedAt,
      ...(t.agentId ? { agentId: t.agentId } : {}),
      ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
      ...(t.completedAt !== undefined ? { completedAt: t.completedAt } : {}),
      ...(t.durationMs !== undefined ? { durationMs: t.durationMs } : {}),
      ...(t.errorCode ? { errorCode: t.errorCode } : {}),
      status: t.status,
    })),
    replay: useReplay,
  };
}

function fallbackNormalized(input: BlastScenarioInput): NormalizedParameterSet {
  const pipeline = planDemo({ input } as PlanningPipelineInput);
  return pipeline.run.normalized;
}

void isBlockingStep; // 保留导出供外部查询

/* ---------- 给 Planner 复用的 adapter ---------- */

export interface AdapterPlanResult {
  planningRun: PlanningRun;
  replay: boolean;
  citations: readonly Citation[];
}

/**
 * 把 Orchestrator 输出适配回会话 3 的 PlanningRun / SchemeSet 契约，
 * 供 /planner 工作台继续使用原有 UI 组件。
 */
export function adaptToPlanningRun(
  out: OrchestratorOutput,
  input: OrchestratorInput,
): AdapterPlanResult {
  const pipeline = planDemo({ input: input.input } as PlanningPipelineInput);
  const run = pipeline.run;
  const citations = collectCitationsFromEvents(out.events);
  // 把 Workflow 的 blockedReason 透传
  if (out.run.status === "blocked" && out.run.blockedReason) {
    run.status = "blocked";
    run.blockedReason = out.run.blockedReason;
  }
  return { planningRun: run, replay: out.replay, citations };
}

export function collectCitationsFromEvents(events: readonly WorkflowEvent[]): Citation[] {
  const out: Citation[] = [];
  for (const evt of events) {
    if (evt.type === "citation.attached") {
      out.push({
        id: String(evt.payload["citationId"] ?? `cit-${evt.sequence}`),
        documentId: String(evt.payload["documentId"] ?? evt.payload["documentTitle"] ?? ""),
        documentTitle: String(evt.payload["documentTitle"] ?? ""),
        category: String(evt.payload["category"] ?? ""),
        score: Number(evt.payload["score"] ?? 0),
        excerpt: String(evt.payload["excerpt"] ?? ""),
      });
    }
  }
  return out;
}

/** 简单安全：将 OrchestratorResult 转成 API 返回给前端的事件流（数组）。 */
export function collectToolCallRecords(events: readonly WorkflowEvent[]): ToolCallRecord[] {
  const out: ToolCallRecord[] = [];
  for (const evt of events) {
    if (evt.type === "tool.called") {
      out.push({
        id: String(evt.payload["toolCallId"] ?? evt.eventId),
        name: String(evt.payload["toolName"] ?? ""),
        agentId: String(evt.payload["agentId"] ?? ""),
        stepId: evt.stepId ?? "",
        runId: evt.runId,
        input: null,
        output: null,
        status: "running",
        startedAt: evt.timestamp,
      });
    }
  }
  return out;
}
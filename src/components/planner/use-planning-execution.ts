"use client";

/**
 * 参数规划工作台客户端状态机（执行体验）。
 *
 * 主要职责：
 * - 把 demo 规划引擎的同步结果拆分成按步骤推进的动画；
 * - 持有当前 run 与步骤事件；
 * - 支持 cancel / reset；
 * - 高风险场景展示"被阻断"提示；
 * - 不做 setTimeout 永久转圈：每个步骤都有明确 status 与 detail。
 *
 * Step 推进由 useEffect + setTimeout 驱动，但允许 cancel 立即中止。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  PLANNING_STEPS,
  planDemo,
  type PlanningPipelineInput,
  type PlanningStepEvent,
  type PlanningStepId,
  type PlanningStepStatus,
  type PlanningRun,
} from "@/modules/parameter-planning/domain";

export type ExecutionPhase =
  | "idle"
  | "running"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "done";

export interface ExecutionState {
  phase: ExecutionPhase;
  steps: readonly PlanningStepEvent[];
  run: PlanningRun | null;
  error: string | null;
}

export interface UsePlanningExecutionOptions {
  /** 是否自动开始 */
  autoStart?: boolean;
  /** 每步停留时长 (ms) */
  stepDurationMs?: number;
}

export interface UsePlanningExecutionResult {
  state: ExecutionState;
  start: (input: PlanningPipelineInput) => void;
  cancel: () => void;
  reset: () => void;
}

export function usePlanningExecution(
  options: UsePlanningExecutionOptions = {},
): UsePlanningExecutionResult {
  const { autoStart = false, stepDurationMs = 520 } = options;

  const [state, setState] = useState<ExecutionState>({
    phase: "idle",
    steps: PLANNING_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      status: "pending",
    })),
    run: null,
    error: null,
  });

  const sequenceRef = useRef<symbol | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const cancelledRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const cancel = useCallback(() => {
    if (state.phase !== "running") return;
    cancelledRef.current = true;
    setState((prev) => ({ ...prev, phase: "cancelling" }));
    clearTimers();
    setState((prev) => ({
      ...prev,
      phase: "cancelled",
      steps: prev.steps.map((s) =>
        s.status === "running" ? { ...s, status: "skipped" as const } : s,
      ),
    }));
  }, [clearTimers, state.phase]);

  const reset = useCallback(() => {
    clearTimers();
    cancelledRef.current = false;
    setState({
      phase: "idle",
      steps: PLANNING_STEPS.map((s) => ({
        id: s.id,
        label: s.label,
        status: "pending",
      })),
      run: null,
      error: null,
    });
  }, [clearTimers]);

  const runSequence = useCallback(
    async (snapshot: PlanningRun, sequence: symbol) => {
      const stepList: PlanningStepEvent[] = snapshot.steps.map((s) => ({
        ...s,
      }));

      /** 立即将首个 step 置为 running */
      const tick = async (
        idx: number,
      ): Promise<void> => {
        if (cancelledRef.current || sequenceRef.current !== sequence) return;
        if (idx >= PLANNING_STEPS.length) {
          setState((prev) => ({
            ...prev,
            phase: "done",
            run: snapshot,
            steps: applyFinalSteps(stepList, snapshot),
          }));
          return;
        }

        /** 当前 step 推进 */
        const cur = PLANNING_STEPS[idx];
        if (!cur) {
          await tick(idx + 1);
          return;
        }
        const event = stepList.find((s) => s.id === cur.id);
        if (event) event.status = "running";

        setState((prev) => ({
          ...prev,
          steps: [...stepList],
        }));

        await wait(stepDurationMs, (t) => timersRef.current.push(t));
        if (cancelledRef.current || sequenceRef.current !== sequence) return;

        /** 中断 propagation：blocked / awaiting_review 状态提前结束 */
        if (
          snapshot.status === "blocked" &&
          (cur.id === "review_safety" || cur.id === "await_human_review")
        ) {
          if (event) event.status = "blocked";
          setState((prev) => ({
            ...prev,
            phase: "done",
            run: snapshot,
            steps: [...stepList],
          }));
          return;
        }

        if (event) event.status = finalStepStatus(cur.id, snapshot);
        setState((prev) => ({
          ...prev,
          steps: [...stepList],
        }));

        if (idx < PLANNING_STEPS.length - 1) {
          await tick(idx + 1);
        }
      };

      await tick(0);
    },
    [stepDurationMs],
  );

  const start = useCallback(
    (input: PlanningPipelineInput) => {
      if (state.phase === "running") return;
      clearTimers();
      cancelledRef.current = false;
      sequenceRef.current = Symbol("planner-exec");

      /** 先调用 demo 引擎得到确定结果 */
      let pipeline;
      try {
        pipeline = planDemo(input);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Demo 规划引擎执行失败";
        setState((prev) => ({ ...prev, phase: "failed", error: message }));
        return;
      }

      const sequence = sequenceRef.current;
      setState((prev) => ({
        ...prev,
        phase: "running",
        run: pipeline.run,
        error: null,
        steps: pipeline.run.steps.map((s) => ({ ...s, status: "pending" })),
      }));

      void runSequence(pipeline.run, sequence ?? Symbol("none"));
    },
    [clearTimers, runSequence, state.phase],
  );

  useEffect(() => {
    if (autoStart) {
      /** autoStart 仅用于预演；调用方应提供 input */
    }
  }, [autoStart]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return useMemo(
    () => ({ state, start, cancel, reset }),
    [state, start, cancel, reset],
  );
}

function applyFinalSteps(
  list: PlanningStepEvent[],
  run: PlanningRun,
): PlanningStepEvent[] {
  return list.map((s) => {
    const target = run.steps.find((r) => r.id === s.id);
    if (!target) return s;
    if (s.status === "running") s.status = "skipped";
    if (s.status === "pending") s.status = "skipped";
    if (
      run.status === "blocked" &&
      (target.id === "review_safety" || target.id === "await_human_review")
    ) {
      return { ...s, status: "blocked" };
    }
    return s;
  });
}

function finalStepStatus(
  id: PlanningStepId,
  run: PlanningRun,
): PlanningStepStatus {
  if (run.status === "blocked") {
    if (id === "review_safety" || id === "await_human_review") return "blocked";
    if (id === "validate_input" || id === "normalize_parameters") return "succeeded";
    if (id === "run_rule_precheck" || id === "plan_parameters") return "succeeded";
    if (id === "generate_schemes" || id === "calculate_scores") return "succeeded";
    return "skipped";
  }
  if (run.status === "awaiting_review") {
    if (id === "review_safety") return "warning";
    if (id === "await_human_review") return "pending";
    return "succeeded";
  }
  return "succeeded";
}

function wait(
  ms: number,
  pushTimer: (t: ReturnType<typeof setTimeout>) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    pushTimer(timer);
  });
}

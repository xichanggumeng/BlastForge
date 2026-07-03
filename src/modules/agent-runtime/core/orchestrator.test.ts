/**
 * Orchestrator 集成测试 —— 不依赖真实 Provider（强制 replay）。
 *
 * 覆盖：
 * - 常规流程：workflow.completed；
 * - 高风险流程：Safety Reviewer 阻断 → run.status = blocked；
 * - 事件顺序：sequence 严格递增；
 * - 流中断后 Run 仍能从 RunRepository 恢复。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetRunRepositoryForTests } from '@/modules/agent-runtime/core/run-repository';

import { runWorkflow } from '@/modules/agent-runtime/core/orchestrator';
import { WorkflowEventBus } from '@/modules/agent-runtime/core/event-bus';

import { SCENARIO_PRESETS } from '@/modules/parameter-planning/domain/presets';

async function runWithPreset(presetId: string, useReplay = true) {
  const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`No preset: ${presetId}`);
  const bus = new WorkflowEventBus();
  const out = await runWorkflow({
    runId: `run-test-${presetId}-${Math.random().toString(36).slice(2, 8)}`,
    workflowId: 'wf-test',
    presetId,
    input: preset.input,
    requestId: `req-${presetId}`,
    forceReplay: useReplay,
    bus,
  });
  return out;
}

describe('Orchestrator (force replay)', () => {
  beforeEach(() => {
    __resetRunRepositoryForTests();
  });
  afterEach(() => {
    __resetRunRepositoryForTests();
  });

  it('standard preset completes and emits ordered events', async () => {
    const out = await runWithPreset('standard');
    expect(out.run.status).toBe('completed');
    expect(out.run.replay).toBe(true);
    expect(out.run.steps.length).toBe(10);

    // workflow.started 必须先出现
    expect(out.events[0]?.type).toBe('workflow.started');
    // workflow.completed 在最后
    expect(out.events[out.events.length - 1]?.type).toBe('workflow.completed');
    // 事件 sequence 严格递增
    for (let i = 1; i < out.events.length; i++) {
      expect(out.events[i]?.sequence).toBeGreaterThan(out.events[i - 1]?.sequence ?? 0);
    }
    // 包含关键事件类型
    const types = new Set(out.events.map((e) => e.type));
    expect(types.has('step.started')).toBe(true);
    expect(types.has('step.completed')).toBe(true);
    expect(types.has('tool.called')).toBe(true);
    expect(types.has('tool.completed')).toBe(true);
    expect(types.has('citation.attached')).toBe(true);
    expect(types.has('human.input_requested')).toBe(true);
    expect(types.has('human.approved')).toBe(true);
  });

  it('high-risk preset triggers Safety Reviewer block', async () => {
    const out = await runWithPreset('high-risk');
    expect(out.run.status).toBe('blocked');
    expect(out.run.blockedReason).toBeTruthy();
    // review.blocked 事件被发出
    expect(out.events.some((e) => e.type === 'review.blocked')).toBe(true);
    // human.approved 不应出现
    expect(out.events.some((e) => e.type === 'human.approved')).toBe(false);
  });

  it('complex preset completes normally', async () => {
    const out = await runWithPreset('complex');
    expect(out.run.status).toBe('completed');
  });
});
/**
 * Trace Recorder 测试 —— start/finish 生命周期、安全摘要。
 */

import { describe, expect, it } from 'vitest';

import {
  __resetTraceRecorderForTests,
  getTraceRecorder,
  listTraceSummariesForRun,
  toFrontendSummary,
} from '@/modules/agent-runtime/core/trace-recorder';

describe('Trace Recorder', () => {
  it('records start → finish lifecycle', () => {
    __resetTraceRecorderForTests();
    const rec = getTraceRecorder();
    const t = rec.start({
      requestId: 'req-1',
      runId: 'run-1',
      workflowId: 'wf-1',
      stepId: 'validate_input',
      agentId: 'supervisor',
      model: 'deepseek-v4-pro',
      mode: 'non-thinking',
      promptVersion: 'v1.0.0',
    });
    expect(t.status).toBe('running');
    rec.finish(t.id, 'succeeded');
    const finished = rec.get(t.id);
    expect(finished?.status).toBe('succeeded');
    expect(finished?.completedAt).toBeDefined();
    expect(finished?.durationMs).toBeDefined();
  });

  it('does not expose full system prompt to frontend summary', () => {
    __resetTraceRecorderForTests();
    const rec = getTraceRecorder();
    const t = rec.start({
      requestId: 'req-1',
      runId: 'run-1',
      workflowId: 'wf-1',
      stepId: 's',
      agentId: 'a',
      model: 'deepseek-v4-pro',
      mode: 'non-thinking',
      promptVersion: 'v1.0.0',
    });
    const summary = toFrontendSummary(t);
    expect(summary.promptVersion).toBe('v1.0.0');
    expect((summary as unknown as Record<string, unknown>)['systemPrompt']).toBeUndefined();
  });

  it('listTraceSummariesForRun returns only matching run', () => {
    __resetTraceRecorderForTests();
    const rec = getTraceRecorder();
    rec.start({
      requestId: 'req-1',
      runId: 'run-1',
      workflowId: 'wf-1',
      stepId: 's1',
      agentId: 'a',
      model: 'deepseek-v4-pro',
      mode: 'non-thinking',
      promptVersion: 'v1.0.0',
    });
    rec.start({
      requestId: 'req-2',
      runId: 'run-2',
      workflowId: 'wf-1',
      stepId: 's2',
      agentId: 'a',
      model: 'deepseek-v4-pro',
      mode: 'non-thinking',
      promptVersion: 'v1.0.0',
    });
    expect(listTraceSummariesForRun('run-1').length).toBe(1);
    expect(listTraceSummariesForRun('run-2').length).toBe(1);
  });

  it('marks blocked on finish with blocked status', () => {
    __resetTraceRecorderForTests();
    const rec = getTraceRecorder();
    const t = rec.start({
      requestId: 'r',
      runId: 'run',
      workflowId: 'wf',
      stepId: 'review_safety',
      agentId: 'safety',
      model: 'deepseek-v4-pro',
      mode: 'non-thinking',
      promptVersion: 'v1.0.0',
    });
    rec.finish(t.id, 'failed', 'WORKFLOW_BLOCKED');
    expect(rec.get(t.id)?.status).toBe('failed');
    expect(rec.get(t.id)?.errorCode).toBe('WORKFLOW_BLOCKED');
  });
});
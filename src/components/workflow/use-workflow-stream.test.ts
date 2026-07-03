/**
 * useWorkflowStream Hook 单元测试 —— 验证 SSE 行解析器 processLine 的鲁棒性。
 *
 * 不依赖 React 渲染（避免引入 happy-dom/jsdom 依赖）；
 * 不触发真实网络（通过 mock fetch）。
 */

import { describe, expect, it } from 'vitest';

import {
  processLine,
  type ProcessLineDeps,
} from '@/components/workflow/use-workflow-stream';
import type {
  FrontendTraceSummary,
  WorkflowEvent,
  WorkflowRun,
} from '@/modules/agent-runtime/core/contracts';

interface DepsState {
  meta: unknown;
  events: WorkflowEvent[];
  blockedSignal: unknown;
  summary: { run: WorkflowRun; traces: FrontendTraceSummary[]; replay: boolean } | null;
  error: { code: string; message: string } | null;
}

function makeDeps(): { deps: ProcessLineDeps; state: DepsState } {
  const state: DepsState = {
    meta: null,
    events: [],
    blockedSignal: null,
    summary: null,
    error: null,
  };
  const deps: ProcessLineDeps = {
    setMeta: (meta) => {
      state.meta = meta;
    },
    appendEvent: (evt) => {
      state.events.push(evt);
    },
    setBlockedSignal: (sig) => {
      state.blockedSignal = sig;
    },
    setSummary: (run, traces, replay) => {
      state.summary = { run, traces, replay };
    },
    setError: (code, message) => {
      state.error = { code, message };
    },
  };
  return { deps, state };
}

describe('useWorkflowStream / processLine', () => {
  it('parses meta line', () => {
    const { deps, state } = makeDeps();
    const ok = processLine(
      `data: ${JSON.stringify({
        type: 'meta',
        runId: 'run-1',
        replay: true,
        model: 'deepseek-v4-pro',
        providerAvailable: false,
        demoReplayEnabled: true,
      })}`,
      deps,
    );
    expect(ok).toBe(true);
    expect(state.meta).toMatchObject({
      runId: 'run-1',
      replay: true,
      providerAvailable: false,
      demoReplayEnabled: true,
    });
  });

  it('parses workflow.event and tracks review.blocked', () => {
    const { deps, state } = makeDeps();
    processLine(
      `data: ${JSON.stringify({
        type: 'workflow.event',
        event: {
          eventId: 'evt-1',
          sequence: 1,
          runId: 'run-1',
          workflowId: 'wf',
          type: 'review.blocked',
          stepId: 'review_safety',
          timestamp: 100,
          payload: {
            stepId: 'review_safety',
            reason: '缺振速',
            ruleCodes: ['INPUT_V_MISSING'],
          },
        },
      })}`,
      deps,
    );
    expect(state.events).toHaveLength(1);
    expect(state.blockedSignal).toMatchObject({
      stepId: 'review_safety',
      reason: '缺振速',
      ruleCodes: ['INPUT_V_MISSING'],
    });
  });

  it('ignores non-data lines and empty payloads', () => {
    const { deps, state } = makeDeps();
    expect(processLine('', deps)).toBe(false);
    expect(processLine('event: ping', deps)).toBe(false);
    expect(processLine('data: ', deps)).toBe(false);
    expect(state.events).toHaveLength(0);
  });

  it('parses workflow.summary', () => {
    const { deps, state } = makeDeps();
    processLine(
      `data: ${JSON.stringify({
        type: 'workflow.summary',
        run: { id: 'run-1', status: 'completed' },
        traces: [],
        replay: false,
      })}`,
      deps,
    );
    expect(state.summary).toMatchObject({ replay: false });
  });

  it('parses workflow.failed error', () => {
    const { deps, state } = makeDeps();
    processLine(
      `data: ${JSON.stringify({
        type: 'workflow.failed',
        code: 'WORKFLOW_FAILED',
        message: 'boom',
      })}`,
      deps,
    );
    expect(state.error).toEqual({ code: 'WORKFLOW_FAILED', message: 'boom' });
  });

  it('does not throw on malformed JSON', () => {
    const { deps } = makeDeps();
    expect(() => processLine('data: not-json', deps)).not.toThrow();
    expect(processLine('data: not-json', deps)).toBe(false);
  });

  it('does nothing for unknown message types', () => {
    const { deps, state } = makeDeps();
    expect(
      processLine(
        `data: ${JSON.stringify({ type: 'something.weird' })}`,
        deps,
      ),
    ).toBe(false);
    expect(state.events).toHaveLength(0);
  });
});
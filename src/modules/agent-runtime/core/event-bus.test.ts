/**
 * Workflow 事件总线测试 —— emit / subscribe / history。
 */

import { describe, expect, it } from 'vitest';

import { WorkflowEventBus } from '@/modules/agent-runtime/core/event-bus';
import type { WorkflowEvent } from '@/modules/agent-runtime/core/contracts';

function makeEvent(
  partial: Omit<WorkflowEvent, 'eventId' | 'sequence'>,
): Omit<WorkflowEvent, 'eventId' | 'sequence'> {
  return partial;
}

describe('Workflow Event Bus', () => {
  it('emits events with sequence and eventId', () => {
    const bus = new WorkflowEventBus();
    const evt = bus.emit(
      makeEvent({
        type: 'workflow.started',
        runId: 'r1',
        workflowId: 'w1',
        timestamp: Date.now(),
        payload: { workflowId: 'w1', fingerprint: 'fp', replay: false, model: 'deepseek-v4-pro' },
      }),
    );
    expect(evt.eventId).toMatch(/^evt-/);
    expect(evt.sequence).toBe(1);
    expect(evt.type).toBe('workflow.started');
  });

  it('historyAll returns events in sequence order', () => {
    const bus = new WorkflowEventBus();
    for (let i = 0; i < 5; i++) {
      bus.emit(
        makeEvent({
          type: 'step.started',
          runId: 'r1',
          workflowId: 'w1',
          timestamp: Date.now() + i,
          stepId: `s${i}`,
          payload: { stepId: `s${i}`, stepLabel: `Step ${i}`, agentId: 'a' },
        }),
      );
    }
    const history = bus.historyAll();
    expect(history.length).toBe(5);
    for (let i = 0; i < history.length; i++) {
      expect(history[i]?.sequence).toBe(i + 1);
    }
  });

  it('subscribes via on(type) and on(*)', () => {
    const bus = new WorkflowEventBus();
    const seen: string[] = [];
    const unsub1 = bus.on('tool.called', (e) => seen.push(`t:${e.type}`));
    const unsub2 = bus.on('*', (e) => seen.push(`a:${e.type}`));
    bus.emit(
      makeEvent({
        type: 'tool.called',
        runId: 'r1',
        workflowId: 'w1',
        timestamp: Date.now(),
        payload: { toolCallId: 'tc', toolName: 'search_knowledge', agentId: 'a' },
      }),
    );
    expect(seen).toContain('t:tool.called');
    expect(seen).toContain('a:tool.called');
    unsub1();
    unsub2();
  });

  it('clear resets the bus', () => {
    const bus = new WorkflowEventBus();
    bus.emit(
      makeEvent({
        type: 'workflow.started',
        runId: 'r1',
        workflowId: 'w1',
        timestamp: Date.now(),
        payload: { workflowId: 'w1', fingerprint: 'fp', replay: false, model: 'deepseek-v4-pro' },
      }),
    );
    bus.clear();
    expect(bus.historyAll().length).toBe(0);
  });
});
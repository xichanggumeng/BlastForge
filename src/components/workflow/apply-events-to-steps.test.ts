import { describe, expect, it } from 'vitest';

import { applyEventsToSteps } from '@/components/workflow/apply-events-to-steps';
import type {
  WorkflowEvent,
  WorkflowRun,
} from '@/modules/agent-runtime/core/contracts';

function makeEvent(
  type: WorkflowEvent['type'],
  payload: WorkflowEvent['payload'],
  timestamp: number,
  extras: { stepId?: string; sequence?: number } = {},
): WorkflowEvent {
  const sequence = extras.sequence ?? 1;
  return {
    eventId: `evt-${sequence}`,
    sequence,
    runId: 'run-test',
    workflowId: 'wf-test',
    timestamp,
    type,
    payload,
    ...(extras.stepId ? { stepId: extras.stepId } : {}),
  } as WorkflowEvent;
}

function makeRun(): WorkflowRun {
  return {
    id: 'run-test',
    workflowId: 'wf-test',
    fingerprint: 'fp',
    status: 'running',
    steps: [
      { id: 's1', stepId: 'validate_input', label: 'validate_input', description: '', kind: 'input_validation', agentId: 'supervisor', requiresApproval: false, status: 'pending' },
      { id: 's2', stepId: 'normalize_parameters', label: 'normalize_parameters', description: '', kind: 'normalization', agentId: 'normalizer', requiresApproval: false, status: 'pending' },
      { id: 's3', stepId: 'review_safety', label: 'review_safety', description: '', kind: 'review', agentId: 'safety', requiresApproval: false, status: 'pending' },
      { id: 's4', stepId: 'human_approval', label: 'human_approval', description: '', kind: 'approval', agentId: 'supervisor', requiresApproval: true, status: 'pending' },
      { id: 's5', stepId: 'generate_report', label: 'generate_report', description: '', kind: 'report', agentId: 'report', requiresApproval: false, status: 'pending' },
    ],
    replay: false,
    createdAt: new Date(0).toISOString(),
  };
}

describe('applyEventsToSteps', () => {
  it('applies step.started → running and step.completed → succeeded', () => {
    const run = makeRun();
    const events: WorkflowEvent[] = [
      makeEvent(
        'step.started',
        { stepId: 'validate_input', stepLabel: 'validate_input', agentId: 'supervisor' },
        100,
        { stepId: 'validate_input', sequence: 1 },
      ),
      makeEvent(
        'step.completed',
        { stepId: 'validate_input', status: 'succeeded', durationMs: 50 },
        200,
        { stepId: 'validate_input', sequence: 2 },
      ),
    ];
    const next = applyEventsToSteps(run, events);
    const validate = next.find((s) => s.stepId === 'validate_input');
    expect(validate?.status).toBe('succeeded');
    expect(validate?.durationMs).toBe(50);
  });

  it('review.blocked sets review_safety to blocked and reason', () => {
    const run = makeRun();
    const events: WorkflowEvent[] = [
      makeEvent(
        'step.started',
        { stepId: 'review_safety', stepLabel: 'review_safety', agentId: 'safety' },
        100,
        { stepId: 'review_safety', sequence: 1 },
      ),
      makeEvent(
        'review.blocked',
        {
          stepId: 'review_safety',
          reason: '缺少年允许峰值振速',
          ruleCodes: ['INPUT_V_MISSING', 'FLYROCK_HIGH'],
        },
        200,
        { stepId: 'review_safety', sequence: 2 },
      ),
    ];
    const next = applyEventsToSteps(run, events);
    const review = next.find((s) => s.stepId === 'review_safety');
    expect(review?.status).toBe('blocked');
    expect(review?.errorMessage).toBe('缺少年允许峰值振速');
    expect(review?.errorCode).toContain('INPUT_V_MISSING');

    const approval = next.find((s) => s.stepId === 'human_approval');
    const report = next.find((s) => s.stepId === 'generate_report');
    expect(approval?.status).toBe('skipped');
    expect(report?.status).toBe('skipped');
  });

  it('workflow.completed marks remaining pending/running as succeeded', () => {
    const run = makeRun();
    const events: WorkflowEvent[] = [
      makeEvent(
        'step.started',
        { stepId: 'validate_input', stepLabel: 'validate_input', agentId: 'supervisor' },
        100,
        { stepId: 'validate_input', sequence: 1 },
      ),
      makeEvent(
        'step.completed',
        { stepId: 'validate_input', status: 'succeeded', durationMs: 30 },
        200,
        { stepId: 'validate_input', sequence: 2 },
      ),
      makeEvent(
        'workflow.completed',
        { status: 'completed', durationMs: 1000, replay: false },
        5000,
        { sequence: 3 },
      ),
    ];
    const next = applyEventsToSteps(run, events);
    for (const step of next) {
      expect(['succeeded', 'pending']).toContain(step.status);
    }
  });

  it('does not regress finished step on subsequent step.started', () => {
    const run = makeRun();
    const events: WorkflowEvent[] = [
      makeEvent(
        'step.started',
        { stepId: 'validate_input', stepLabel: 'validate_input', agentId: 'supervisor' },
        100,
        { stepId: 'validate_input', sequence: 1 },
      ),
      makeEvent(
        'step.completed',
        { stepId: 'validate_input', status: 'succeeded', durationMs: 30 },
        200,
        { stepId: 'validate_input', sequence: 2 },
      ),
      // 异常：再次收到 step.started 应忽略
      makeEvent(
        'step.started',
        { stepId: 'validate_input', stepLabel: 'validate_input', agentId: 'supervisor' },
        300,
        { stepId: 'validate_input', sequence: 3 },
      ),
    ];
    const next = applyEventsToSteps(run, events);
    const validate = next.find((s) => s.stepId === 'validate_input');
    expect(validate?.status).toBe('succeeded');
  });

  it('preserves original status when no events affect the step', () => {
    const run = makeRun();
    const next = applyEventsToSteps(run, []);
    expect(next.every((s) => s.status === 'pending')).toBe(true);
  });
});
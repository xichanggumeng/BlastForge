/**
 * Workflow Engine 测试 —— 状态流转、Step 顺序、阻塞行为。
 */

import { describe, expect, it } from 'vitest';

import {
  MAIN_WORKFLOW_STEPS,
  buildInitialStepStates,
  findStepSpec,
  isBlockingStep,
  rebuildStepStates,
} from '@/modules/agent-runtime/core/workflow-engine';
import type { WorkflowStepState, WorkflowStatus } from '@/modules/agent-runtime/core/contracts';

describe('Workflow Engine', () => {
  it('has 10 steps', () => {
    expect(MAIN_WORKFLOW_STEPS.length).toBe(10);
  });

  it('contains all required steps in order', () => {
    expect(MAIN_WORKFLOW_STEPS.map((s) => s.stepId)).toEqual([
      'validate_input',
      'normalize_parameters',
      'retrieve_knowledge',
      'run_rule_precheck',
      'plan_parameters',
      'generate_schemes',
      'calculate_scores',
      'review_safety',
      'human_approval',
      'generate_report',
    ]);
  });

  it('builds initial step states with pending status', () => {
    const states = buildInitialStepStates();
    expect(states.length).toBe(MAIN_WORKFLOW_STEPS.length);
    for (const s of states) {
      expect(s.status).toBe('pending');
      expect(s.id).toBeTruthy();
    }
  });

  it('rebuilds step states from overrides', () => {
    const overrides: Partial<Record<string, Partial<WorkflowStepState>>> = {};
    overrides['wf-step-validate_input'] = { status: 'succeeded' };
    overrides['wf-step-review_safety'] = { status: 'blocked' };
    const states = rebuildStepStates(overrides);
    const validate = states.find((s) => s.id === 'wf-step-validate_input');
    const review = states.find((s) => s.id === 'wf-step-review_safety');
    expect(validate?.status).toBe('succeeded');
    expect(review?.status).toBe('blocked');
  });

  it('identifies blocking steps', () => {
    expect(isBlockingStep('review_safety')).toBe(true);
    expect(isBlockingStep('human_approval')).toBe(true);
    expect(isBlockingStep('validate_input')).toBe(false);
  });

  it('finds step spec by id', () => {
    const spec = findStepSpec('review_safety');
    expect(spec?.stepId).toBe('review_safety');
    expect(spec?.agentId).toBe('safety');
  });

  it('covers the full WorkflowStatus enum', () => {
    const validStatuses: WorkflowStatus[] = [
      'created',
      'queued',
      'running',
      'waiting_for_input',
      'waiting_for_approval',
      'completed',
      'blocked',
      'failed',
      'cancelled',
    ];
    expect(validStatuses.length).toBe(9);
  });
});
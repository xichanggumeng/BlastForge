/**
 * Replay 测试 —— 验证预录制数据完整、Snapshot 重建一致性。
 */

import { describe, expect, it } from 'vitest';

import { getReplay, listReplays } from '@/modules/agent-runtime/core/replay';
import { buildReplaySnapshot } from '@/modules/agent-runtime/core/replay-snapshot';

describe('Demo Replay', () => {
  it('contains standard / complex / high-risk presets', () => {
    expect(listReplays().length).toBe(3);
    expect(getReplay('standard')).not.toBeNull();
    expect(getReplay('complex')).not.toBeNull();
    expect(getReplay('high-risk')).not.toBeNull();
  });

  it('high-risk preset sets highRisk flag', () => {
    const hr = getReplay('high-risk');
    expect(hr?.highRisk).toBe(true);
    const standard = getReplay('standard');
    expect(standard?.highRisk).toBe(false);
  });

  it('replay snapshot produces a complete WorkflowRun with 10 steps', () => {
    const data = getReplay('standard');
    if (!data) throw new Error('no data');
    const snap = buildReplaySnapshot('standard', data);
    expect(snap.run.steps.length).toBe(10);
    expect(snap.run.replay).toBe(true);
    expect(snap.run.status).toBe('completed');
    expect(snap.events.length).toBeGreaterThan(15);
    expect(snap.traces.length).toBeGreaterThanOrEqual(7);
  });

  it('high-risk replay snapshot ends as blocked', () => {
    const data = getReplay('high-risk');
    if (!data) throw new Error('no data');
    const snap = buildReplaySnapshot('high-risk', data);
    expect(snap.run.status).toBe('blocked');
    expect(snap.run.blockedReason).toBeTruthy();
    // 包含 review.blocked 事件
    expect(snap.events.some((e) => e.type === 'review.blocked')).toBe(true);
  });

  it('replay snapshot events are sequenced correctly', () => {
    const data = getReplay('complex');
    if (!data) throw new Error('no data');
    const snap = buildReplaySnapshot('complex', data);
    for (let i = 0; i < snap.events.length; i++) {
      expect(snap.events[i]?.sequence).toBe(i + 1);
    }
  });
});
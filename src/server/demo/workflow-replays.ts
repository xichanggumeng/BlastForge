/**
 * 预录制 Run 数据 —— 服务端种子文件。
 *
 * 服务端 / 客户端通过 `agent-runtime` 模块统一消费，
 * 避免在前端硬编码大段数据。
 */

import { getReplay } from '@/modules/agent-runtime/core/replay';
import {
  buildCitationsFromReplay,
  buildReplaySnapshot,
} from '@/modules/agent-runtime/core/replay-snapshot';
import type { DemoReplayRun } from '@/components/workflow/workflow-viewer-client';

function replayToDemoRun(presetId: string, label: string, scenario: string): DemoReplayRun {
  const data = getReplay(presetId);
  if (!data) throw new Error(`未找到预录制数据：${presetId}`);
  const snapshot = buildReplaySnapshot(presetId, data);
  return {
    id: `replay-${presetId}`,
    presetId,
    label,
    scenario,
    replay: true,
    run: snapshot.run,
    events: snapshot.events,
    traces: snapshot.traces,
    citations: buildCitationsFromReplay(data),
  };
}

export const DEMO_REPLAY_RUNS: DemoReplayRun[] = [
  replayToDemoRun('standard', '常规爆破：台阶 12m', '台阶高度 12m · 岩石 f=8'),
  replayToDemoRun('complex', '复杂环境爆破：城市周边', '距敏感建筑 80m'),
  replayToDemoRun('high-risk', '高风险场景：振速超阈值', '飞石控制距离 35m'),
];
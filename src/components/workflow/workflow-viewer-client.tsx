/**
 * Workflow 视图的客户端组件：
 *
 * Phase 3 落地后，本组件承担三件事：
 * 1. 顶部 Tab：当前 Run / 预录制 Run；
 * 2. 真实 Run Tab 内置"SSE 实时流"模式：提供「启动演示」按钮组（Standard / Complex / High-Risk × replay=1），
 *    通过 useWorkflowStream Hook 订阅 /api/agent/runs/stream，事件驱动 WorkflowFlow；
 * 3. 保留原"最近 Run"列表（REST 轮询）作为历史 Run 二级 Tab，方便演示者在不重启 Run 的情况下回看已完成 Run。
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import {
  AlertOctagon,
  PauseCircle,
  PlayCircle,
  Radio,
  Sparkles,
  StopCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { LoadingState } from '@/components/feedback/loading-state';
import { cn } from '@/lib/cn';

import type {
  Citation,
  FrontendTraceSummary,
  WorkflowEvent,
  WorkflowRun,
} from '@/modules/agent-runtime/core/contracts';
import {
  SCENARIO_PRESETS,
  type ScenarioPresetId,
} from '@/modules/parameter-planning/domain';

import { useWorkflowStream } from './use-workflow-stream';
import { WorkflowFlow } from './workflow-flow';

export interface DemoReplayRun {
  id: string;
  presetId: string;
  label: string;
  scenario: string;
  replay: true;
  run: WorkflowRun;
  events: WorkflowEvent[];
  traces: FrontendTraceSummary[];
  citations: Citation[];
}

export interface WorkflowViewerClientProps {
  replays: readonly DemoReplayRun[];
}

const PRESET_BUTTON_META: Record<
  ScenarioPresetId,
  { label: string; description: string; tone: 'primary' | 'warning' | 'danger' }
> = {
  standard: {
    label: '启动演示 · 常规',
    description: '主流程顺畅：参数完整、规则无冲突。',
    tone: 'primary',
  },
  complex: {
    label: '启动演示 · 复杂',
    description: '多约束对比：含水 + 周边 + 成本折衷。',
    tone: 'primary',
  },
  'high-risk': {
    label: '启动演示 · 高风险',
    description: 'Safety Reviewer 阻断；自动 blocked。',
    tone: 'danger',
  },
};

export function WorkflowViewerClient({ replays }: WorkflowViewerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') === 'live' ? 'live' : 'replay';
  const runIdParam = searchParams.get('runId');

  const setTab = useCallback(
    (next: 'live' | 'replay') => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      router.replace(`/workflow?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <Card padding="md" className="gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={tab === 'replay'} onClick={() => setTab('replay')}>
          预录制 Run
        </TabButton>
        <TabButton active={tab === 'live'} onClick={() => setTab('live')}>
          实时流（含演示回放）
        </TabButton>
      </div>

      {tab === 'replay' ? (
        <ReplaySection replays={replays} initialRunId={runIdParam} />
      ) : (
        <LiveSection initialRunId={runIdParam} />
      )}
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-primary/60 bg-primary/10 text-primary'
          : 'border-border bg-surface text-muted-foreground hover:bg-muted/40',
      )}
    >
      {children}
    </button>
  );
}

function ReplaySection({
  replays,
  initialRunId,
}: {
  replays: readonly DemoReplayRun[];
  initialRunId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRunId ?? replays[0]?.id ?? null,
  );

  // Re-derive selectedId when initialRunId prop changes
  const [lastInitial, setLastInitial] = useState(initialRunId);
  if (initialRunId !== lastInitial) {
    setLastInitial(initialRunId);
    if (initialRunId) setSelectedId(initialRunId);
  }

  const selected = useMemo(
    () => replays.find((r) => r.id === selectedId) ?? replays[0],
    [replays, selectedId],
  );

  if (!selected) {
    return (
      <EmptyState
        title="没有可用的预录制 Run"
        description="请重新加载页面或检查数据源。"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {replays.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedId(r.id)}
            aria-pressed={selected.id === r.id}
            className={cn(
              'flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-xs transition-colors',
              selected.id === r.id
                ? 'border-primary/60 bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted-foreground hover:bg-muted/40',
            )}
          >
            <span className="font-semibold">{r.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {r.scenario}
            </span>
          </button>
        ))}
      </div>

      <WorkflowFlow
        run={selected.run}
        events={selected.events}
        traces={selected.traces}
        citations={selected.citations}
      />
    </div>
  );
}

/**
 * 实时流 Tab：
 * - 顶部：演示回放触发按钮组（强制 replay=1）+ 停止按钮；
 * - 中部：流式状态徽章 + Workflow 视图（数据来自 Hook state.run / events / traces / citations）；
 * - 当 review.blocked 事件触发时，顶部出现红色阻断警告卡且自动 focus 对应节点。
 */
function LiveSection({ initialRunId }: { initialRunId: string | null }) {
  const stream = useWorkflowStream();
  const { state, start, cancel, reset } = stream;
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);

  const isStreaming = state.phase === 'connecting' || state.phase === 'streaming';
  const replayActive =
    state.meta?.replay === true || state.run?.replay === true;
  const hasLiveRun = state.run !== null;

  const triggerReplay = useCallback(
    (presetId: ScenarioPresetId) => {
      const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      // 每次启动前清空旧 blocked signal 与选中节点
      setSelectedStepId(null);
      void start({ presetId, input: preset.input, replay: true });
    },
    [start],
  );

  // 当 SSE 收到 review.blocked 时，自动选中 review_safety 节点
  useEffect(() => {
    if (state.blockedSignal?.stepId) {
      setSelectedStepId(state.blockedSignal.stepId);
    }
  }, [state.blockedSignal?.stepId, state.blockedSignal?.timestamp]);

  const liveFlow = useMemo(() => {
    if (!state.run) return null;
    return (
      <WorkflowFlow
        run={state.run}
        events={state.events}
        traces={state.traces}
        citations={state.citations}
        externalSelectedStepId={selectedStepId}
        blockedHighlightSignal={state.blockedSignal}
      />
    );
  }, [state, selectedStepId]);

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部：模式徽章 + 启动按钮组 */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary" size="sm">
          <Radio className="h-3 w-3" aria-hidden />
          实时流
        </Badge>
        {replayActive ? (
          <Badge tone="warning" size="sm">
            <Sparkles className="h-3 w-3" aria-hidden />
            演示回放模式
          </Badge>
        ) : null}
        {state.meta?.providerAvailable === false ? (
          <Badge tone="outline" size="sm">
            Provider 不可用
          </Badge>
        ) : null}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {state.meta?.model ?? 'deepseek-v4-pro'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PRESET_BUTTON_META) as ScenarioPresetId[]).map((id) => {
          const meta = PRESET_BUTTON_META[id];
          return (
            <Button
              key={id}
              type="button"
              variant={
                meta.tone === 'danger'
                  ? 'danger'
                  : meta.tone === 'warning'
                    ? 'outline'
                    : 'primary'
              }
              size="sm"
              onClick={() => triggerReplay(id)}
              disabled={isStreaming}
              leftIcon={<PlayCircle className="h-3.5 w-3.5" />}
            >
              {meta.label}
            </Button>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            cancel();
          }}
          disabled={!isStreaming}
          leftIcon={<StopCircle className="h-3.5 w-3.5" />}
        >
          停止
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setSelectedStepId(null);
          }}
          leftIcon={<PauseCircle className="h-3.5 w-3.5" />}
        >
          重置
        </Button>
        <button
          type="button"
          onClick={() => setShowHistorical((v) => !v)}
          aria-pressed={showHistorical}
          className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
        >
          {showHistorical ? '隐藏历史 Run' : '查看历史 Run'}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        点击按钮会以 replay=1 调用 /api/agent/runs/stream，自动回放预录制 Run；
        通过 SSE 推送的 workflow.* / agent.* / tool.* 事件驱动节点状态。
        Provider 不可用时自动降级，UI 通过右上角&ldquo;演示回放模式&rdquo;徽章明确标识。
      </p>

      {/* review.blocked 自动警告卡 */}
      {state.blockedSignal ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger/50 bg-danger/10 p-3 text-xs"
        >
          <AlertOctagon className="mt-0.5 h-4 w-4 text-danger" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-danger">
              Safety Reviewer 已自动阻断
            </span>
            <p className="text-danger/90">{state.blockedSignal.reason}</p>
            {state.blockedSignal.ruleCodes.length > 0 ? (
              <p className="font-mono text-[11px] text-danger/80">
                规则：{state.blockedSignal.ruleCodes.join(' · ')}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedStepId(state.blockedSignal?.stepId ?? null)}
            className="ml-auto"
          >
            查看节点
          </Button>
        </div>
      ) : null}

      {/* 主区：流状态 */}
      {state.phase === 'connecting' ? (
        <LoadingState label="正在连接 Workflow 流（演示回放已启用）" />
      ) : null}

      {state.phase === 'failed' ? (
        <ErrorState
          title="Workflow 流失败"
          description={
            state.error?.message ?? '流式接口返回错误；可重试或选择预录制 Run。'
          }
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => reset()}
            >
              重置
            </Button>
          }
        />
      ) : null}

      {state.phase === 'cancelled' && !hasLiveRun ? (
        <EmptyState
          title="已取消"
          description="可重新选择预设以启动新的演示回放。"
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => reset()}
            >
              重置
            </Button>
          }
        />
      ) : null}

      {liveFlow}

      {/* 历史 Run 二级 Tab */}
      {showHistorical ? (
        <HistoricalRunSection initialRunId={initialRunId} />
      ) : null}
    </div>
  );
}

/**
 * 历史 Run：从 /api/agent/runs 拉取最近已完成的 Run；只读视图。
 * 用于演示者在 SSE 流已结束后回看。
 */
function HistoricalRunSection({
  initialRunId,
}: {
  initialRunId: string | null;
}) {
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [traces, setTraces] = useState<FrontendTraceSummary[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/runs?limit=10', { cache: 'no-store' });
      const json = (await res.json()) as {
        success: boolean;
        data: WorkflowRun[];
        error?: { message: string };
      };
      if (!json.success) throw new Error(json.error?.message ?? '加载失败');
      setRuns(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRun = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/runs/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { run: WorkflowRun; events: WorkflowEvent[]; traces: FrontendTraceSummary[] };
        error?: { message: string };
      };
      if (!json.success || !json.data) throw new Error(json.error?.message ?? '查询失败');
      setSelectedRun(json.data.run);
      setEvents(json.data.events);
      setTraces(json.data.traces);
      const list: Citation[] = [];
      for (const evt of json.data.events) {
        if (evt.type === 'citation.attached') {
          list.push({
            id: String(evt.payload['citationId'] ?? evt.eventId),
            documentId: String(
              evt.payload['documentId'] ?? evt.payload['documentTitle'] ?? '',
            ),
            documentTitle: String(evt.payload['documentTitle'] ?? ''),
            category: String(evt.payload['category'] ?? ''),
            score: Number(evt.payload['score'] ?? 0),
            excerpt: String(evt.payload['excerpt'] ?? ''),
          });
        }
      }
      setCitations(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (initialRunId) {
      void fetchRun(initialRunId);
    }
  }, [initialRunId, fetchRun]);

  if (loading && !runs) {
    return <LoadingState label="正在加载最近 Run" />;
  }

  if (error) {
    return (
      <ErrorState
        title="无法加载 Workflow Run"
        description={error}
        action={
          <button
            type="button"
            onClick={() => void fetchRuns()}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
          >
            重试
          </button>
        }
      />
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <EmptyState
        title="尚无 Run"
        description="启动一次演示回放即可生成 Run；也可前往 /planner 启动真实 Run。"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-surface/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          历史 Run（仅读）
        </span>
        {runs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => void fetchRun(r.id)}
            aria-pressed={selectedRun?.id === r.id}
            className={cn(
              'flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-xs transition-colors',
              selectedRun?.id === r.id
                ? 'border-primary/60 bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted-foreground hover:bg-muted/40',
            )}
          >
            <span className="flex items-center gap-2">
              <Badge
                tone={
                  r.status === 'completed'
                    ? 'success'
                    : r.status === 'blocked'
                      ? 'danger'
                      : 'outline'
                }
                size="sm"
              >
                {r.status}
              </Badge>
              <span className="font-mono text-[11px]">{r.id.slice(-8)}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {r.replay ? '回放' : '真实'} ·{' '}
              {new Date(r.createdAt).toLocaleTimeString()}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => void fetchRuns()}
          className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted-foreground"
        >
          刷新
        </button>
      </div>

      {selectedRun ? (
        <WorkflowFlow
          run={selectedRun}
          events={events}
          traces={traces}
          citations={citations}
        />
      ) : (
        <EmptyState
          title="请选择一次 Run"
          description="点击上方任意 Run 卡片查看 Workflow 详情。"
        />
      )}
    </div>
  );
}
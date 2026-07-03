/**
 * Workflow 视图的客户端组件：
 * - 顶部 Tab：当前 Run / 预录制 Run；
 * - 当前 Run 通过 /api/agent/runs 拉取最近 N 条；
 * - 预录制 Run 由 server 文件预渲染传入；
 * - 使用 React Flow 渲染 WorkflowFlow；
 * - 真实运行演示可在 /planner 触发后回到此页面查询。
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
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
          真实 Run（最近）
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
  const [selectedId, setSelectedId] = useState<string | null>(initialRunId ?? replays[0]?.id ?? null);

  // Re-derive selectedId when initialRunId prop changes
  const [lastInitial, setLastInitial] = useState(initialRunId);
  if (initialRunId !== lastInitial) {
    setLastInitial(initialRunId);
    if (initialRunId) setSelectedId(initialRunId);
  }

  const selected = useMemo(() => replays.find((r) => r.id === selectedId) ?? replays[0], [replays, selectedId]);

  if (!selected) {
    return <EmptyState title="没有可用的预录制 Run" description="请重新加载页面或检查数据源。" />;
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
            <span className="text-[10px] text-muted-foreground">{r.scenario}</span>
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

function LiveSection({ initialRunId }: { initialRunId: string | null }) {
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
      const json = (await res.json()) as { success: boolean; data: WorkflowRun[]; error?: { message: string } };
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
      const res = await fetch(`/api/agent/runs/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = (await res.json()) as {
        success: boolean;
        data?: { run: WorkflowRun; events: WorkflowEvent[]; traces: FrontendTraceSummary[] };
        error?: { message: string };
      };
      if (!json.success || !json.data) throw new Error(json.error?.message ?? '查询失败');
      setSelectedRun(json.data.run);
      setEvents(json.data.events);
      setTraces(json.data.traces);
      // 提取 citations
      const list: Citation[] = [];
      for (const evt of json.data.events) {
        if (evt.type === 'citation.attached') {
          list.push({
            id: String(evt.payload['citationId'] ?? evt.eventId),
            documentId: String(evt.payload['documentId'] ?? evt.payload['documentTitle'] ?? ''),
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
        description="前往 /planner 启动一次 Workflow；或选择预录制 Run 查看完整事件流。"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
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
              <Badge tone={r.status === 'completed' ? 'success' : r.status === 'blocked' ? 'danger' : 'outline'} size="sm">
                {r.status}
              </Badge>
              <span className="font-mono text-[11px]">{r.id.slice(-8)}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {r.replay ? '回放' : '真实'} · {new Date(r.createdAt).toLocaleTimeString()}
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
        <WorkflowFlow run={selectedRun} events={events} traces={traces} citations={citations} />
      ) : (
        <EmptyState title="请选择一次 Run" description="点击上方任意 Run 卡片查看 Workflow 详情。" />
      )}
    </div>
  );
}
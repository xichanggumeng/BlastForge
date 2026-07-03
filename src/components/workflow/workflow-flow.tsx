/**
 * React Flow Workflow 可视化页面（客户端组件）。
 *
 * 渲染当前 Run / 预录制 Run 的 Workflow 节点 + 连线 + 状态；
 * 支持点击节点查看详情；running 节点脉冲；blocked / failed 视觉警示；
 * 移动端简化视图（Bottom Sheet）。
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import {
  AlertOctagon,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Loader2,
  PauseCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import type {
  Citation,
  StepStatus,
  WorkflowRun,
  WorkflowStepState,
  WorkflowEvent,
  FrontendTraceSummary,
} from '@/modules/agent-runtime/core/contracts';

/* ---------- 节点自定义 ---------- */

interface StepNodeData extends Record<string, unknown> {
  id: string;
  stepId: string;
  label: string;
  description: string;
  agentId: string;
  status: StepStatus;
  citations: Citation[];
  toolCalls: { id: string; name: string; durationMs?: number }[];
  events: WorkflowEvent[];
}

function StepNode({ data, selected }: NodeProps<Node<StepNodeData>>) {
  const status = data.status;
  const isRunning = status === 'running';
  const isBlocked = status === 'blocked';
  const isFailed = status === 'failed';
  const isSucceeded = status === 'succeeded';
  const isWarning = status === 'warning';

  const tone = isBlocked || isFailed
    ? 'danger'
    : isRunning
      ? 'primary'
      : isWarning
        ? 'warning'
        : isSucceeded
          ? 'success'
          : 'muted';

  const toneClass = {
    danger: 'border-danger/60 bg-danger/10 text-danger',
    primary: 'border-primary/60 bg-primary/10 text-primary',
    warning: 'border-warning/60 bg-warning/10 text-warning',
    success: 'border-success/60 bg-success/10 text-success',
    muted: 'border-border bg-surface text-muted-foreground',
  }[tone];

  const Icon = isRunning
    ? Loader2
    : isBlocked
      ? ShieldAlert
      : isFailed
        ? X
      : isWarning
        ? ShieldAlert
        : isSucceeded
          ? Check
          : CircleDashed;

  return (
    <div
      className={cn(
        'flex min-w-[180px] max-w-[220px] flex-col gap-1 rounded-lg border bg-surface px-3 py-2 text-left shadow-sm transition-colors',
        toneClass,
        selected && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-md border bg-surface/70',
            isRunning && 'animate-pulse',
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', isRunning && 'animate-spin')} aria-hidden />
        </span>
        <span className="text-xs font-semibold">{data.label}</span>
      </div>
      <p className="line-clamp-2 text-[10px] text-muted-foreground">{data.description}</p>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
          {data.agentId}
        </span>
        {data.toolCalls.length > 0 ? (
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
            {data.toolCalls.length} tool
          </span>
        ) : null}
        {data.citations.length > 0 ? (
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
            {data.citations.length} ref
          </span>
        ) : null}
      </div>
      {isRunning ? (
        <span className="text-[10px] text-primary">执行中</span>
      ) : isBlocked ? (
        <span className="text-[10px] text-danger">Safety Reviewer 阻断</span>
      ) : typeof data.durationMs === 'number' ? (
        <span className="text-[10px] text-muted-foreground">{data.durationMs} ms</span>
      ) : null}
    </div>
  );
}

const nodeTypes: NodeTypes = { step: StepNode };

/* ---------- 边颜色辅助 ---------- */

function statusEdgeColor(status: StepStatus, hasError: boolean): string {
  if (hasError) return 'var(--danger)';
  if (status === 'succeeded') return 'var(--success)';
  if (status === 'warning') return 'var(--warning)';
  if (status === 'running') return 'var(--primary)';
  if (status === 'blocked' || status === 'failed') return 'var(--danger)';
  return 'var(--border)';
}

/* ---------- 组件 ---------- */

interface WorkflowFlowProps {
  run: WorkflowRun;
  events: WorkflowEvent[];
  traces: FrontendTraceSummary[];
  citations: Citation[];
}

export function WorkflowFlow({ run, events, traces, citations }: WorkflowFlowProps) {
  const toolCalls = useMemo(() => {
    const map = new Map<string, { id: string; name: string; durationMs?: number }>();
    for (const evt of events) {
      if (evt.type === 'tool.called') {
        const id = String(evt.payload['toolCallId'] ?? evt.eventId);
        const name = String(evt.payload['toolName'] ?? '');
        map.set(id, { id, name });
      } else if (evt.type === 'tool.completed') {
        const id = String(evt.payload['toolCallId'] ?? '');
        const dur = Number(evt.payload['durationMs'] ?? 0);
        const prev = map.get(id);
        if (prev) prev.durationMs = dur;
      }
    }
    return map;
  }, [events]);

  const eventsByStep = useMemo(() => {
    const m = new Map<string, WorkflowEvent[]>();
    for (const e of events) {
      if (!e.stepId) continue;
      const list = m.get(e.stepId) ?? [];
      list.push(e);
      m.set(e.stepId, list);
    }
    return m;
  }, [events]);

  const tracesByStep = useMemo(() => {
    const m = new Map<string, FrontendTraceSummary[]>();
    for (const t of traces) {
      const list = m.get(t.stepId) ?? [];
      list.push(t);
      m.set(t.stepId, list);
    }
    return m;
  }, [traces]);

  const citationsByStep = useMemo(() => {
    const m = new Map<string, Citation[]>();
    for (const e of events) {
      if (e.type === 'citation.attached' && e.stepId) {
        const id = String(e.payload['citationId'] ?? '');
        const c = citations.find((x) => x.id === id);
        if (c) {
          const list = m.get(e.stepId) ?? [];
          list.push(c);
          m.set(e.stepId, list);
        }
      }
    }
    return m;
  }, [events, citations]);

  const initialNodes = useMemo<Node<StepNodeData>[]>(() => {
    return run.steps.map((step, idx) => ({
      id: step.id,
      type: 'step',
      position: { x: 0, y: idx * 130 },
      data: {
        id: step.id,
        stepId: step.stepId,
        label: step.label,
        description: step.description,
        agentId: step.agentId,
        status: step.status,
        citations: citationsByStep.get(step.stepId) ?? [],
        toolCalls: Array.from(toolCalls.values()).filter((t) => {
          const ev = events.find((e) => e.type === 'tool.called' && e.payload['toolCallId'] === t.id);
          return ev?.stepId === step.stepId;
        }),
        events: eventsByStep.get(step.stepId) ?? [],
      },
    }));
  }, [run.steps, toolCalls, eventsByStep, citationsByStep, events]);

  const initialEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = [];
    for (let i = 0; i < run.steps.length - 1; i++) {
      const cur = run.steps[i];
      const nxt = run.steps[i + 1];
      if (!cur || !nxt) continue;
      edges.push({
        id: `${cur.id}->${nxt.id}`,
        source: cur.id,
        target: nxt.id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: statusEdgeColor(cur.status, false) },
        style: {
          stroke: statusEdgeColor(cur.status, false),
          strokeWidth: cur.status === 'running' ? 2 : 1.4,
        },
      });
    }
    return edges;
  }, [run.steps]);

  const [nodes, , onNodesChange] = useNodesState<Node<StepNodeData>>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    onNodesChange(
      initialNodes.map((n) => ({ id: n.id, type: 'position', position: n.position })) as never,
    );
  }, [initialNodes, onNodesChange]);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const selectedStep = useMemo(() => {
    if (!selectedStepId) return null;
    return run.steps.find((s) => s.id === selectedStepId) ?? null;
  }, [run.steps, selectedStepId]);

  const selectedCitations = useMemo(() => {
    if (!selectedStep) return [] as Citation[];
    return citationsByStep.get(selectedStep.stepId) ?? [];
  }, [selectedStep, citationsByStep]);

  const selectedTools = useMemo(() => {
    if (!selectedStep) return [] as { id: string; name: string; durationMs?: number }[];
    return Array.from(toolCalls.values()).filter((t) => {
      const ev = events.find((e) => e.type === 'tool.called' && e.payload['toolCallId'] === t.id);
      return ev?.stepId === selectedStep.stepId;
    });
  }, [selectedStep, toolCalls, events]);

  const selectedTraces = useMemo(() => {
    if (!selectedStep) return [] as FrontendTraceSummary[];
    return tracesByStep.get(selectedStep.stepId) ?? [];
  }, [selectedStep, tracesByStep]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedStepId(node.id);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={run.replay ? 'warning' : 'primary'} size="sm">
            {run.replay ? '演示回放模式' : '真实调用'}
          </Badge>
          <Badge tone={run.status === 'completed' ? 'success' : run.status === 'blocked' ? 'danger' : 'outline'} size="sm">
            Run {run.id.slice(-6)} · {run.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {run.steps.length} 个步骤 · {events.length} 个事件 · {traces.length} 条 Trace
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card padding="md" className="gap-2 lg:col-span-2">
            <div className="h-[420px] w-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </div>
          </Card>

          <div className="hidden lg:block">
            <StepDetailPanel
              step={selectedStep}
              citations={selectedCitations}
              tools={selectedTools}
              traces={selectedTraces}
            />
          </div>
        </div>

        {selectedStep ? (
          <div className="block lg:hidden">
            <StepDetailPanel
              step={selectedStep}
              citations={selectedCitations}
              tools={selectedTools}
              traces={selectedTraces}
              compact
            />
          </div>
        ) : null}

        <Card padding="md" className="gap-2">
          <h3 className="text-sm font-semibold">事件序列</h3>
          <p className="text-[11px] text-muted-foreground">
            按时间顺序展示本次 Run 的关键事件；不展示隐藏思维过程。
          </p>
          <ol className="mt-2 flex flex-col gap-1.5 text-xs">
            {events.slice(-20).map((evt) => (
              <li
                key={evt.eventId}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  #{evt.sequence} {evt.type}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {evt.stepId ?? '-'} · {evt.agentId ?? '-'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
            {events.length === 0 ? (
              <li className="text-xs text-muted-foreground">暂无事件</li>
            ) : null}
          </ol>
        </Card>
      </div>
    </ReactFlowProvider>
  );
}

function StepDetailPanel({
  step,
  citations,
  tools,
  traces,
  compact,
}: {
  step: WorkflowStepState | null;
  citations: Citation[];
  tools: { id: string; name: string; durationMs?: number }[];
  traces: FrontendTraceSummary[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(true);

  if (!step) {
    return (
      <Card padding="md" tone="muted">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">节点详情</h3>
            <p className="text-xs text-muted-foreground">
              点击任意 Workflow 节点查看输入 / 输出 / Tool / 引用 / Trace 摘要。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const tone = step.status === 'blocked' || step.status === 'failed'
    ? 'danger'
    : step.status === 'running'
      ? 'primary'
      : step.status === 'succeeded'
        ? 'success'
        : step.status === 'warning'
          ? 'warning'
          : 'outline';

  return (
    <Card padding={compact ? 'md' : 'md'} className={cn('gap-2', compact && 'lg:hidden')}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{step.label}</h3>
        <Badge tone={tone as never} size="sm">
          {step.status}
        </Badge>
      </header>
      <p className="text-xs text-muted-foreground">{step.description}</p>

      {step.outputSummary ? (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
          <span className="font-semibold">输出摘要：</span> {step.outputSummary}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Tools ({tools.length})
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {open ? (
          <ul className="mt-1 flex flex-col gap-1.5 text-xs">
            {tools.length === 0 ? (
              <li className="text-muted-foreground">该步骤未触发 Tool。</li>
            ) : (
              tools.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1">
                  <span className="font-mono">{t.name}</span>
                  <span className="text-muted-foreground">{t.durationMs ?? '-'} ms</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <div>
        <h4 className="text-xs font-semibold">引用 ({citations.length})</h4>
        <ul className="mt-1 flex flex-col gap-1.5 text-xs">
          {citations.length === 0 ? (
            <li className="text-muted-foreground">无引用</li>
          ) : (
            citations.map((c) => (
              <li key={c.id} className="rounded border border-border bg-surface px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{c.documentTitle}</span>
                  <Badge tone="outline" size="sm">
                    {c.category}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{c.excerpt}</p>
              </li>
            ))
          )}
        </ul>
      </div>

      <div>
        <h4 className="text-xs font-semibold">Trace 摘要 ({traces.length})</h4>
        <ul className="mt-1 flex flex-col gap-1.5 text-xs">
          {traces.length === 0 ? (
            <li className="text-muted-foreground">无 Trace</li>
          ) : (
            traces.map((t) => (
              <li key={t.id} className="rounded border border-border bg-surface px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{t.agentId ?? '-'} · {t.promptVersion}</span>
                  <Badge
                    tone={t.status === 'succeeded' ? 'success' : t.status === 'failed' ? 'danger' : 'outline'}
                    size="sm"
                  >
                    {t.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t.model} · {t.mode} · {t.durationMs ?? '-'} ms
                </p>
              </li>
            ))
          )}
        </ul>
      </div>

      {step.errorMessage ? (
        <div className="rounded-md border border-danger/40 bg-danger/5 p-2 text-xs text-danger">
          <AlertOctagon className="mr-1 inline h-3.5 w-3.5" /> {step.errorCode} · {step.errorMessage}
        </div>
      ) : null}
    </Card>
  );
}

export { ShieldCheck, PauseCircle };
import Link from 'next/link';
import {
  ArrowUpRight,
  Bot,
  Boxes,
  CheckCircle2,
  CircuitBoard,
  Cpu,
  Database,
  FileSearch,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

import { PageHeader } from '@/components/feedback/page-header';
import { SectionHeader } from '@/components/feedback/section-header';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WorkspaceGrid, WorkspacePage } from '@/components/layout/workspace-page';

import { AGENT_REGISTRY } from '@/modules/agent-runtime/core/agent-registry';
import { listTools } from '@/modules/agent-runtime/core/tool-registry';
import { MAIN_WORKFLOW_STEPS } from '@/modules/agent-runtime/core/workflow-engine';
import { PROMPT_VERSIONS } from '@/modules/agent-runtime/core/prompt-registry';
import { getReplay } from '@/modules/agent-runtime/core/replay';
import { getRunRepository } from '@/modules/agent-runtime/core/run-repository';

export const metadata = {
  title: 'Agent 工作台',
};

export default function AgentsPage() {
  const repo = getRunRepository();
  const recentRuns = repo.listRecentForFrontend(8);
  const replayCount = Object.keys(getReplay('standard') ? { standard: 1, complex: 1, 'high-risk': 1 } : {}).length;
  const planSteps = MAIN_WORKFLOW_STEPS.length;
  const totalTools = listTools().length;

  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Agent Pool"
        title="Agent 工作台"
        description="可组合的能力中心：8 个 Agent + 8 个 Tool + 10 个 Workflow Step；Prompt 集中版本化，Trace 全程留痕。"
        icon={Bot}
        meta={
          <>
            <Badge tone="primary">deepseek-v4-pro</Badge>
            <Badge tone="outline">{AGENT_REGISTRY.length} agents</Badge>
            <Badge tone="outline">{totalTools} tools</Badge>
            <Badge tone="outline">{planSteps} steps</Badge>
          </>
        }
      />

      <section aria-labelledby="agents-summary" className="flex flex-col gap-4">
        <SectionHeader
          title="Runtime 总览"
          description="展示 Agent 池能力分布、Tool 覆盖、Workflow 长度与 Prompt 当前版本。"
        />
        <WorkspaceGrid columns={4}>
          <SummaryCard
            icon={Cpu}
            label="规划类 Agent"
            value={String(AGENT_REGISTRY.filter((a) => ['planner', 'generator', 'supervisor'].includes(a.id)).length)}
            hint="Supervisor / Planner / Generator"
          />
          <SummaryCard
            icon={Wrench}
            label="工具调用 Agent"
            value={String(AGENT_REGISTRY.filter((a) => ['retriever', 'evaluator', 'safety', 'report'].includes(a.id)).length)}
            hint="Retriever / Evaluator / Safety / Report"
          />
          <SummaryCard
            icon={CircuitBoard}
            label="Tool 数量"
            value={String(totalTools)}
            hint="确定性强 + Demo 知识检索"
          />
          <SummaryCard
            icon={Boxes}
            label="Prompt 版本"
            value={PROMPT_VERSIONS.supervisor}
            hint="统一版本号管理"
          />
        </WorkspaceGrid>
      </section>

      <section aria-labelledby="agents-list" className="flex flex-col gap-4">
        <SectionHeader
          title="Agent 池（可组合能力中心）"
          description="点击 Agent 查看输入输出 Schema、可用 Tool、版本、最近 Trace。"
        />
        <WorkspaceGrid columns={2}>
          {AGENT_REGISTRY.map((agent) => (
            <AgentCard key={agent.id} agentId={agent.id} />
          ))}
        </WorkspaceGrid>
      </section>

      <section aria-labelledby="tools-list" className="flex flex-col gap-4">
        <SectionHeader
          title="Tool Registry"
          description="Tool 有唯一名称，Zod 输入输出，记录执行状态与耗时；确定性计算复用会话 3 纯函数。"
        />
        <WorkspaceGrid columns={2}>
          {listTools().map((tool) => (
            <ToolCard key={tool.name} toolName={tool.name} />
          ))}
        </WorkspaceGrid>
      </section>

      <section aria-labelledby="agents-recent" className="flex flex-col gap-4">
        <SectionHeader
          title="最近 Workflow Run"
          description="由服务端 RunRepository 维护；前端仅展示安全摘要。"
        />
        {recentRuns.length === 0 ? (
          <Card tone="muted" padding="md">
            <p className="text-xs text-muted-foreground">
              暂无 Run；前往 Planner 启动一次 Agent Workflow（自动降级到演示回放即可看到记录）。
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {recentRuns.map((run) => (
              <Card key={run.id} tone="muted" padding="md" className="gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{run.id.slice(-10)}</span>
                  <Badge tone={run.status === 'completed' ? 'success' : run.status === 'blocked' ? 'danger' : 'outline'} size="sm">
                    {run.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone={run.replay ? 'warning' : 'primary'} size="sm">
                    {run.replay ? '回放' : '真实'}
                  </Badge>
                  {run.presetId ? (
                    <Badge tone="outline" size="sm">
                      {run.presetId}
                    </Badge>
                  ) : null}
                  <span className="text-muted-foreground">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </div>
                <ButtonLink href={`/workflow?tab=live&runId=${run.id}`} label="查看 Workflow" />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="agents-replay" className="flex flex-col gap-4">
        <SectionHeader
          title="预录制 Replay"
          description="Provider 不可用 / 模型失败 / 输出 Schema 不匹配时，Orchestrator 自动使用这些预录制 Run 驱动动画。"
        />
        <Card tone="muted" padding="md">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge tone="warning">演示回放模式</Badge>
            <span>共 {replayCount} 套预录制数据（standard / complex / high-risk）</span>
            <ButtonLink href="/workflow?tab=replay" label="查看回放 Workflow" />
          </div>
        </Card>
      </section>
    </WorkspacePage>
  );
}

function AgentCard({ agentId }: { agentId: string }) {
  const agent = AGENT_REGISTRY.find((a) => a.id === agentId);
  if (!agent) return null;
  return <AgentCardBody agent={agent} />;
}

function AgentCardBody({ agent }: { agent: (typeof AGENT_REGISTRY)[number] }) {
  const IconKey = agent.id;
  return (
    <Card tone="elevated" padding="lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary"
            >
              <StaticAgentIcon id={IconKey} />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle>{agent.name}</CardTitle>
              <CardDescription>{agent.description}</CardDescription>
            </div>
          </div>
          <Badge tone="primary" size="sm">
            {agent.promptVersion}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone="outline">{agent.model}</Badge>
          <Badge tone={agent.mode === 'thinking' ? 'primary' : 'accent'} size="sm">
            {agent.mode}
          </Badge>
          <Badge tone="neutral" size="sm">
            max {agent.maxSteps}
          </Badge>
          <Badge tone="neutral" size="sm">
            {agent.timeoutMs}ms
          </Badge>
          {agent.requiresApproval ? (
            <Badge tone="warning" size="sm">
              needs approval
            </Badge>
          ) : null}
        </div>

        <SchemaBlock title="Input Schema" schema={describeSchema(agent.inputSchema as { shape?: Record<string, unknown> })} />
        <SchemaBlock title="Output Schema" schema={describeSchema(agent.outputSchema as { shape?: Record<string, unknown> })} />

        {agent.tools.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tools</span>
            <div className="flex flex-wrap gap-1.5">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ToolCard({ toolName }: { toolName: string }) {
  const tool = listTools().find((t) => t.name === toolName);
  if (!tool) return null;
  return <ToolCardBody tool={tool} />;
}

function ToolCardBody({ tool }: { tool: ReturnType<typeof listTools>[number] }) {
  const IconKey = tool.name;
  return (
    <Card tone="muted" padding="md">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent"
        >
          <StaticToolIcon name={IconKey} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-semibold text-foreground">{tool.name}</span>
          <span className="text-xs text-muted-foreground">{tool.description}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
        <SchemaBlock title="Input" schema={describeSchema(tool.inputSchema as { shape?: Record<string, unknown> })} compact />
        <SchemaBlock title="Output" schema={describeSchema(tool.outputSchema as { shape?: Record<string, unknown> })} compact />
      </div>
    </Card>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card tone="elevated" padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-primary"
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <span className="tabular text-2xl font-semibold text-foreground">{value}</span>
      </CardHeader>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function SchemaBlock({
  title,
  schema,
  compact,
}: {
  title: string;
  schema: { keys: readonly string[] };
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'rounded-md border border-border bg-muted/40 p-2 text-[11px]'
          : 'rounded-md border border-border bg-muted/40 p-2 text-xs'
      }
    >
      <span className="font-semibold text-foreground">{title}: </span>
      <span className="font-mono text-muted-foreground">
        {schema.keys.length > 0 ? `{ ${schema.keys.join(', ')} }` : 'void'}
      </span>
    </div>
  );
}

function ButtonLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 self-start rounded-md border border-border bg-surface px-2 py-1 text-xs text-primary transition-colors hover:bg-muted/40"
    >
      <ArrowUpRight className="h-3 w-3" aria-hidden /> {label}
    </Link>
  );
}

function describeSchema(schema: { shape?: Record<string, unknown> }): { keys: readonly string[] } {
  if (!schema || typeof schema !== 'object') return { keys: [] };
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  if (!shape || typeof shape !== 'object') return { keys: [] };
  return { keys: Object.keys(shape) };
}

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  supervisor: Sparkles,
  normalizer: CircuitBoard,
  retriever: FileSearch,
  planner: Cpu,
  generator: GitBranch,
  evaluator: CheckCircle2,
  safety: ShieldAlert,
  report: Database,
};

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  search_knowledge: FileSearch,
  run_rule_check: ShieldCheck,
  calculate_scheme_score: CheckCircle2,
  analyze_parameter_sensitivity: Cpu,
  compare_schemes: GitBranch,
  request_human_approval: ShieldAlert,
  build_report_outline: Database,
  normalize_engineering_parameters: CircuitBoard,
};

function StaticAgentIcon({ id }: { id: string }) {
  const Icon = AGENT_ICONS[id] ?? Bot;
  return <Icon className="h-4 w-4" />;
}

function StaticToolIcon({ name }: { name: string }) {
  const Icon = TOOL_ICONS[name] ?? Wrench;
  return <Icon className="h-4 w-4" />;
}
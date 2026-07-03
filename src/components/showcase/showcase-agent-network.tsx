"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useMemo } from "react";

import {
  AGENT_GROUP_LABEL,
  type AgentNetworkTopology,
} from "./showcase-agent-topology";
import { cn } from "@/lib/cn";

export interface ShowcaseAgentNetworkProps {
  topology: AgentNetworkTopology;
  /** Optional title shown above the canvas. */
  title?: string;
  /** Visible caption / description. */
  description?: string;
  /** Visual size preset. */
  variant?: "showcase" | "compact";
  className?: string;
}

const TONE_COLORS: Record<
  "primary" | "accent" | "success" | "warning" | "danger",
  { stroke: string; glow: string }
> = {
  primary: { stroke: "var(--primary)", glow: "color-mix(in oklab, var(--primary) 35%, transparent)" },
  accent: { stroke: "var(--accent)", glow: "color-mix(in oklab, var(--accent) 35%, transparent)" },
  success: { stroke: "var(--success)", glow: "color-mix(in oklab, var(--success) 35%, transparent)" },
  warning: { stroke: "var(--warning)", glow: "color-mix(in oklab, var(--warning) 35%, transparent)" },
  danger: { stroke: "var(--danger)", glow: "color-mix(in oklab, var(--danger) 35%, transparent)" },
};

const GROUP_FILL: Record<string, string> = {
  supervisor: "color-mix(in oklab, var(--primary) 18%, transparent)",
  input: "color-mix(in oklab, var(--accent) 12%, transparent)",
  knowledge: "color-mix(in oklab, var(--accent) 18%, transparent)",
  planning: "color-mix(in oklab, var(--primary) 14%, transparent)",
  review: "color-mix(in oklab, var(--warning) 14%, transparent)",
  report: "color-mix(in oklab, var(--success) 14%, transparent)",
};

/**
 * SVG-based Agent Network visualization used on the showcase landing
 * page. Animations respect `prefers-reduced-motion`.
 */
export function ShowcaseAgentNetwork({
  topology,
  title,
  description,
  variant = "showcase",
  className,
}: ShowcaseAgentNetworkProps) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");

  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof topology.nodes)[number]>();
    topology.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [topology]);

  const viewBoxHeight = variant === "compact" ? 220 : 360;
  const viewBoxWidth = 600;
  const nodeSize = variant === "compact" ? 26 : 34;

  return (
    <div
      role="group"
      aria-label={title ?? "Agent 协作网络"}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-surface/60",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-pattern opacity-30"
      />

      <header className="flex items-center justify-between gap-2 px-5 pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Agentic Workflow · 实时拓扑
          </span>
          {title ? (
            <span className="text-sm font-semibold text-foreground">{title}</span>
          ) : null}
          {description ? (
            <span className="text-xs text-muted-foreground">{description}</span>
          ) : null}
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            Supervisor 激活
          </span>
        </div>
      </header>

      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        role="img"
        aria-label="多 Agent 数据流示意图"
        className="relative z-10 mt-2 block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {Object.entries(TONE_COLORS).map(([tone, colors]) => (
            <marker
              key={tone}
              id={`arrow-${tone}-${id}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={colors.stroke} />
            </marker>
          ))}
        </defs>

        {/* Edges */}
        <g strokeWidth={1.4} fill="none">
          {topology.edges.map((edge, idx) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const tone = TONE_COLORS[edge.tone];
            // Curved path between two points for a softer feel.
            const midX = (from.x + to.x) / 2;
            const c1x = midX;
            const c1y = from.y;
            const c2x = midX;
            const c2y = to.y;
            const path = `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
            return (
              <g key={`${edge.from}-${edge.to}-${idx}`}>
                <path
                  d={path}
                  stroke={tone.stroke}
                  strokeOpacity={0.35}
                  strokeDasharray="4 4"
                />
                {/* Animated travelling dot */}
                {!reduce ? (
                  <motion.circle
                    r={2.4}
                    fill={tone.stroke}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0] }}
                    transition={{
                      duration: 3.2,
                      repeat: Infinity,
                      delay: (idx % 5) * 0.4,
                      ease: "linear",
                    }}
                  >
                    <animateMotion
                      dur="3.2s"
                      repeatCount="indefinite"
                      begin={`${(idx % 5) * 0.4}s`}
                      path={path}
                    />
                  </motion.circle>
                ) : (
                  <circle r={2.4} fill={tone.stroke} cx={to.x} cy={to.y} opacity={0.6} />
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {topology.nodes.map((node, idx) => {
            const fill = GROUP_FILL[node.group] ?? "var(--surface)";
            const labelOffset = variant === "compact" ? 30 : 36;
            return (
              <g key={node.id}>
                {!reduce ? (
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeSize / 1.6}
                    fill={fill}
                    stroke="var(--border-strong)"
                    strokeWidth={1}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.05 * idx,
                      ease: [0.22, 0.61, 0.36, 1],
                    }}
                  />
                ) : (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeSize / 1.6}
                    fill={fill}
                    stroke="var(--border-strong)"
                    strokeWidth={1}
                  />
                )}
                {/* Pulse */}
                {!reduce ? (
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeSize / 2}
                    stroke="var(--primary)"
                    strokeWidth={1}
                    fill="transparent"
                    animate={{
                      scale: [0.8, 1.6, 1.6],
                      opacity: [0.6, 0, 0],
                    }}
                    transition={{
                      duration: 2.6,
                      repeat: Infinity,
                      delay: 0.4 + idx * 0.18,
                      ease: "easeOut",
                    }}
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  />
                ) : null}
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y - labelOffset}
                  textAnchor="middle"
                  fill="var(--foreground)"
                  fontFamily="var(--font-geist-sans), 'PingFang SC', system-ui"
                  fontSize={variant === "compact" ? 11 : 12}
                  fontWeight={600}
                >
                  {node.label}
                </text>
                <text
                  x={node.x}
                  y={node.y - labelOffset + (variant === "compact" ? 11 : 13)}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  fontFamily="var(--font-geist-sans), 'PingFang SC', system-ui"
                  fontSize={variant === "compact" ? 9 : 10}
                >
                  {node.role}
                </text>
                {/* Active state for Supervisor */}
                {node.id === "supervisor" && !reduce ? (
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={4}
                    fill="var(--primary)"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Group legend */}
      <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-border bg-surface/60 px-4 py-3 text-[11px] text-muted-foreground">
        {Object.entries(AGENT_GROUP_LABEL).map(([group, label]) => (
          <span
            key={group}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: GROUP_FILL[group] ?? "var(--muted)" }}
            />
            {label}
          </span>
        ))}
      </footer>
    </div>
  );
}
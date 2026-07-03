/**
 * Agent Definition Schema 测试 —— 验证所有 8 个 Agent 都符合 AgentDefinitionMeta。
 */

import { describe, expect, it } from 'vitest';

import { AGENT_REGISTRY, listAgents } from '@/modules/agent-runtime/core/agent-registry';

describe('Agent Registry', () => {
  it('exposes 8 agents', () => {
    expect(listAgents().length).toBe(8);
    expect(AGENT_REGISTRY.length).toBe(8);
  });

  it('every agent has all required meta fields', () => {
    for (const agent of listAgents()) {
      expect(agent.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(agent.name.length).toBeGreaterThan(0);
      expect(agent.description.length).toBeGreaterThan(0);
      expect(agent.model).toMatch(/deepseek/);
      expect(['thinking', 'non-thinking']).toContain(agent.mode);
      expect(agent.tools.length).toBeGreaterThanOrEqual(0);
      expect(agent.maxSteps).toBeGreaterThan(0);
      expect(agent.timeoutMs).toBeGreaterThan(0);
      expect(agent.promptVersion).toMatch(/^v\d+\.\d+\.\d+$/);
      expect(typeof agent.requiresApproval).toBe('boolean');
      expect(agent.inputSchema).toBeDefined();
      expect(agent.outputSchema).toBeDefined();
    }
  });

  it('all agent ids are unique', () => {
    const ids = listAgents().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('required core agents exist', () => {
    const ids = listAgents().map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'supervisor',
        'normalizer',
        'retriever',
        'planner',
        'generator',
        'evaluator',
        'safety',
        'report',
      ]),
    );
  });

  it('tool references point to known tools', async () => {
    const { listTools } = await import('@/modules/agent-runtime/core/tool-registry');
    const toolNames = new Set(listTools().map((t) => t.name));
    for (const agent of listAgents()) {
      for (const t of agent.tools) {
        expect(toolNames.has(t)).toBe(true);
      }
    }
  });

  it('only supervisor and report declare requiresApproval behavior', () => {
    const approvals = listAgents().filter((a) => a.requiresApproval);
    expect(approvals.map((a) => a.id).sort()).toEqual(['report']);
  });
});
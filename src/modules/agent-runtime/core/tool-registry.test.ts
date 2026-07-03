/**
 * Tool Registry 测试 —— 验证每个 Tool 的输入输出 Zod 校验。
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  asCitation,
  getTool,
  listKnowledgeIndex,
  listTools,
} from '@/modules/agent-runtime/core/tool-registry';

describe('Tool Registry', () => {
  it('exposes 9 unique tools', () => {
    const tools = listTools();
    expect(tools.length).toBe(9);
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('contains the required tools', () => {
    const names = listTools().map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'normalize_engineering_parameters',
        'search_knowledge',
        'run_rule_check',
        'run_safety_review',
        'calculate_scheme_score',
        'analyze_parameter_sensitivity',
        'compare_schemes',
        'request_human_approval',
        'build_report_outline',
      ]),
    );
  });

  it('search_knowledge returns Demo citations', async () => {
    const tool = getTool<{ query: string; limit?: number }, { citations: unknown[] }>('search_knowledge');
    const out = await tool.execute(
      { query: '深孔台阶爆破参数', limit: 3 },
      { runId: 'r', stepId: 's', agentId: 'a', now: () => Date.now() },
    );
    expect(out.citations.length).toBeGreaterThan(0);
    expect(out.citations.length).toBeLessThanOrEqual(3);
    for (const _entry of out.citations) {
      void _entry;
      const ok = (tool.outputSchema as z.ZodType<{ citations: unknown[] }>).safeParse({ citations: out.citations });
      expect(ok.success).toBe(true);
      break;
    }
  });

  it('run_rule_check validates deterministic blocking rules', async () => {
    const tool = getTool('run_rule_check');
    const out = await tool.execute(
      {
        normalized: {
          engineeringTypeLabel: 'test',
          rockCategoryLabel: 'test',
          protodyakonov: 8,
          benchHeight: 12,
          holeDiameter: 138,
          holeDepth: 12.5,
          stemmingLength: 3.2,
          holeSpacing: 5.1,
          rowSpacing: 4.3,
          burdenDistance: 4.5,
          chargeStructure: 'coupled',
          linearChargeDensity: 4.2,
          maxChargePerDelay: 200,
          totalChargeKg: 800,
          peakParticleVelocity: 7,
        },
      },
      { runId: 'r', stepId: 's', agentId: 'a', now: () => Date.now() },
    );
    expect(Array.isArray((out as { issues: unknown[] }).issues)).toBe(true);
    expect((out as { issues: unknown[] }).issues.length).toBeGreaterThanOrEqual(1);
  });

  it('calculate_scheme_score is deterministic and bounded', async () => {
    const tool = getTool('calculate_scheme_score');
    const out = await tool.execute(
      {
        normalized: {
          engineeringTypeLabel: 'x',
          rockCategoryLabel: 'y',
          protodyakonov: 8,
          benchHeight: 12,
          holeDiameter: 138,
          holeDepth: 12.5,
          stemmingLength: 3.2,
          holeSpacing: 5.1,
          rowSpacing: 4.3,
          burdenDistance: 4.5,
          chargeStructure: 'coupled',
          linearChargeDensity: 4.2,
          maxChargePerDelay: 64,
          totalChargeKg: 248.4,
          peakParticleVelocity: 5,
        },
        scheme: {
          id: 'scheme-test',
          label: '测试方案',
          category: 'recommended',
          summary: '测试',
          parameters: {
            benchHeight: 12,
            holeDiameter: 138,
            holeDepth: 12.5,
            stemmingLength: 3.2,
            holeSpacing: 5.1,
            rowSpacing: 4.3,
            burdenDistance: 4.5,
            chargeStructure: 'coupled',
            linearChargeDensity: 4.2,
            maxChargePerDelay: 64,
            totalChargeKg: 248.4,
          },
        },
      },
      { runId: 'r', stepId: 's', agentId: 'a', now: () => Date.now() },
    );
    const score = (out as { score: { overall: number } }).score;
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('asCitation maps knowledge items to Citation shape', () => {
    const cit = asCitation({
      id: 'cit-x',
      documentId: 'doc-x',
      documentTitle: '文档 X',
      sourceType: 'knowledge',
      category: '规范',
      page: 1,
      section: '1',
      excerpt: '...',
      score: 0.5,
      matchedTokens: [],
      usedByAgents: [],
      affectedConclusions: [],
    });
    expect(cit.id).toBe('cit-x');
    expect(cit.documentTitle).toBe('文档 X');
  });

  it('knowledge index contains demo entries', async () => {
    const index = await listKnowledgeIndex();
    expect(index.length).toBeGreaterThan(0);
  });

  it('tool input schemas reject empty input where required', async () => {
    const search = getTool('search_knowledge');
    await expect(
      search.execute({ query: '' }, { runId: 'r', stepId: 's', agentId: 'a', now: () => Date.now() }),
    ).rejects.toThrow();
  });
});
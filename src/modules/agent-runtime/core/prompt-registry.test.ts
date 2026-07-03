/**
 * Prompt Registry 测试 —— 版本号、Agent-Version 映射。
 */

import { describe, expect, it } from 'vitest';

import {
  PROMPT_REGISTRY,
  PROMPT_VERSIONS,
  getPrompt,
  listPromptSummaries,
} from '@/modules/agent-runtime/core/prompt-registry';

describe('Prompt Registry', () => {
  it('every agent has a registered prompt', () => {
    for (const agentId of Object.keys(PROMPT_VERSIONS)) {
      const version = PROMPT_VERSIONS[agentId as keyof typeof PROMPT_VERSIONS];
      const prompt = getPrompt(agentId, version);
      expect(prompt.agentId).toBe(agentId);
      expect(prompt.system.length).toBeGreaterThan(0);
    }
  });

  it('falls back to known prompt when version matches', () => {
    const prompt = getPrompt('supervisor', PROMPT_VERSIONS.supervisor);
    expect(prompt.id).toBe('supervisor.main');
  });

  it('all registered prompts contain safety prefix keywords', () => {
    for (const prompt of PROMPT_REGISTRY) {
      expect(prompt.system).toMatch(/BlastForge Runtime Constraints|禁止|不得|人工|simulated|mock/);
    }
  });

  it('does not request hidden thought process', () => {
    for (const prompt of PROMPT_REGISTRY) {
      expect(prompt.system).not.toMatch(/隐藏思维|inner.*thought|think.*step.*by.*step.*hidden/);
    }
  });

  it('prompt summaries hide full system prompt', () => {
    const summaries = listPromptSummaries();
    for (const s of summaries) {
      // 只暴露摘要字段
      expect(Object.keys(s).sort()).toEqual(['agentId', 'id', 'summary', 'version'].sort());
    }
  });

  it('all system prompts declare simulated / mock data', () => {
    for (const prompt of PROMPT_REGISTRY) {
      expect(prompt.system).toMatch(/simulated|mock|预测|讨论|辅助/);
    }
  });
});
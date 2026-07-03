/**
 * Server Config 测试 —— 环境变量读取与默认值。
 */

import { afterEach, describe, expect, it } from 'vitest';

describe('Server AI Config', () => {
  const originalEnv = { ...process.env };

  afterEach(async () => {
    process.env = { ...originalEnv };
    const { __resetServerAIConfigForTests } = await import('@/modules/agent-runtime/server/server-config');
    __resetServerAIConfigForTests();
  });

  it('reads DEEPSEEK_API_KEY and model', async () => {
    process.env['DEEPSEEK_API_KEY'] = 'sk-test-1234567890';
    process.env['DEEPSEEK_MODEL'] = 'deepseek-v4-pro';
    const { getServerAIConfig, __resetServerAIConfigForTests } = await import('@/modules/agent-runtime/server/server-config');
    __resetServerAIConfigForTests();
    const cfg = getServerAIConfig();
    expect(cfg.deepseekApiKey).toBe('sk-test-1234567890');
    expect(cfg.deepseekModel).toBe('deepseek-v4-pro');
  });

  it('uses default base URL when not set', async () => {
    delete process.env['DEEPSEEK_BASE_URL'];
    const { getServerAIConfig, __resetServerAIConfigForTests } = await import('@/modules/agent-runtime/server/server-config');
    __resetServerAIConfigForTests();
    const cfg = getServerAIConfig();
    expect(cfg.deepseekBaseUrl).toBe('https://api.deepseek.com/v1');
  });

  it('falls back to demo replay when no key', async () => {
    delete process.env['DEEPSEEK_API_KEY'];
    process.env['DEMO_REPLAY_ENABLED'] = 'true';
    const { getServerAIConfig, __resetServerAIConfigForTests } = await import('@/modules/agent-runtime/server/server-config');
    __resetServerAIConfigForTests();
    const cfg = getServerAIConfig();
    expect(cfg.demoReplayEnabled).toBe(true);
    expect(cfg.deepseekApiKey).toBeNull();
  });

  it('parses numeric AI_REQUEST_TIMEOUT_MS', async () => {
    process.env['AI_REQUEST_TIMEOUT_MS'] = '45000';
    const { getServerAIConfig, __resetServerAIConfigForTests } = await import('@/modules/agent-runtime/server/server-config');
    __resetServerAIConfigForTests();
    const cfg = getServerAIConfig();
    expect(cfg.aiRequestTimeoutMs).toBe(45000);
  });

  it('parses boolean DEMO_REPLAY_ENABLED', async () => {
    process.env['DEMO_REPLAY_ENABLED'] = '0';
    const { getServerAIConfig, __resetServerAIConfigForTests } = await import('@/modules/agent-runtime/server/server-config');
    __resetServerAIConfigForTests();
    const cfg = getServerAIConfig();
    expect(cfg.demoReplayEnabled).toBe(false);
  });
});
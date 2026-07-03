/**
 * 服务端 AI 配置（Server-only）。
 *
 * 严格：
 * - 仅在服务端（Route Handler / Server Action / Agent Runtime）读取；
 * - 不导出任何对浏览器端可见的值；
 * - 任何 API Key / Base URL 不得出现在客户端 bundle 中。
 *
 * 读取顺序：
 * 1. 进程环境变量
 * 2. 默认值（保守默认）
 *
 * DEEPSEEK_API_KEY 缺失时，Provider Adapter 不可用 → Runtime 自动降级到 Demo Replay。
 */

import "server-only";

/** 服务端环境变量读取。 */
function readString(name: string, fallback: string): string {
  const v = process.env[name];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return fallback;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return fallback;
}

export interface ServerAIConfig {
  readonly deepseekApiKey: string | null;
  readonly deepseekBaseUrl: string;
  readonly deepseekModel: string;
  readonly aiRequestTimeoutMs: number;
  readonly demoReplayEnabled: boolean;
}

/** 单例：服务端启动后只读一次。 */
let cached: ServerAIConfig | null = null;

export function getServerAIConfig(): ServerAIConfig {
  if (cached) return cached;
  const apiKeyRaw = process.env["DEEPSEEK_API_KEY"];
  const apiKey =
    typeof apiKeyRaw === "string" && apiKeyRaw.trim() !== "" ? apiKeyRaw.trim() : null;
  cached = {
    deepseekApiKey: apiKey,
    deepseekBaseUrl: readString("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
    deepseekModel: readString("DEEPSEEK_MODEL", "deepseek-v4-pro"),
    aiRequestTimeoutMs: readNumber("AI_REQUEST_TIMEOUT_MS", 20_000),
    demoReplayEnabled: readBool("DEMO_REPLAY_ENABLED", true),
  };
  return cached;
}

/** 仅测试用：清空缓存以重新读取环境变量。 */
export function __resetServerAIConfigForTests(): void {
  cached = null;
}
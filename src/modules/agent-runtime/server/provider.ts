/**
 * DeepSeek Provider Adapter（Server-only）。
 *
 * 封装 OpenAI 兼容的 Chat Completions 接口：
 *   POST {baseUrl}/chat/completions
 *
 * 设计目标：
 * - 不让 Agent / Tool / UI 直接依赖 DeepSeek SDK；
 * - 通过统一 LanguageModelProvider 接口暴露；
 * - 支持 generateObject（结构化输出 + Zod 校验）与 streamText；
 * - 所有请求携带 timeout 与 AbortSignal；
 * - API Key 仅在服务端内存中存在，不参与前端 bundle；
 * - 不可用 / 超时 / 校验失败时抛 ProviderError，由 Runtime 决定降级。
 */

import "server-only";

import { z } from "zod";

import {
  type GenerateObjectInput,
  type LanguageModelProvider,
  type StreamTextHandle,
  type StreamTextInput,
} from "../core/contracts";
import { getServerAIConfig } from "./server-config";

export class ProviderError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/* ---------- 内部：DeepSeek HTTP 客户端 ---------- */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionsRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: "json_object" };
}

interface ChatCompletionsResponseChoice {
  index: number;
  message: { role: "assistant"; content: string };
  finish_reason?: string;
}

interface ChatCompletionsResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionsChoice[];
}

interface ChatCompletionsChoice {
  index: number;
  delta?: { content?: string };
  message?: ChatCompletionsResponseChoice["message"];
  finish_reason?: string;
}

/** 创建带超时的 fetch。 */
function createAbortController(timeoutMs: number, signal?: AbortSignal): {
  controller: AbortController;
  clear: () => void;
} {
  const controller = new AbortController();
  const linked = (): void => {
    if (signal?.aborted) controller.abort(signal.reason);
  };
  linked();
  signal?.addEventListener("abort", linked);
  const timer = setTimeout(() => controller.abort(new Error("PROVIDER_TIMEOUT")), timeoutMs);
  return {
    controller,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", linked);
    },
  };
}

async function callDeepSeekOnce(
  body: ChatCompletionsRequest,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ChatCompletionsResponse> {
  const cfg = getServerAIConfig();
  if (!cfg.deepseekApiKey) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", "DeepSeek API Key 未配置");
  }
  const { controller, clear } = createAbortController(timeoutMs, signal);
  try {
    const url = `${cfg.deepseekBaseUrl.replace(/\/+$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.deepseekApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(
        res.status === 401 || res.status === 403 ? "PROVIDER_AUTH_FAILED" : "PROVIDER_HTTP_ERROR",
        `DeepSeek 调用失败 (${res.status})`,
        text.slice(0, 500),
      );
    }
    const data = (await res.json()) as ChatCompletionsResponse;
    return data;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (controller.signal.aborted) {
      throw new ProviderError("PROVIDER_TIMEOUT", "DeepSeek 调用超时");
    }
    throw new ProviderError("PROVIDER_NETWORK_ERROR", "DeepSeek 网络错误", err);
  } finally {
    clear();
  }
}

/* ---------- Provider Adapter 实现 ---------- */

export class DeepSeekProvider implements LanguageModelProvider {
  readonly name = "deepseek";
  readonly isAvailable: boolean;

  constructor() {
    this.isAvailable = Boolean(getServerAIConfig().deepseekApiKey);
  }

  async generateObject<T>(input: GenerateObjectInput<T>): Promise<T> {
    const sys = input.systemPrompt;
    const usr = `${input.userPrompt}\n\nRespond ONLY with a single JSON object that matches the requested schema. Do not wrap it in markdown or code fences.`;

    const cfg = getServerAIConfig();
    const response = await callDeepSeekOnce(
      {
        model: input.model || cfg.deepseekModel,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
        temperature: 0.2,
        max_tokens: 2048,
        stream: false,
        response_format: { type: "json_object" },
      },
      input.timeoutMs,
      input.signal,
    );

    const choice = response.choices?.[0];
    const content = choice?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new ProviderError(
        "PROVIDER_OUTPUT_INVALID",
        "模型输出无法解析为 JSON",
        err,
      );
    }
    const safe = input.schema.safeParse(parsed);
    if (!safe.success) {
      throw new ProviderError(
        "PROVIDER_OUTPUT_INVALID",
        "模型输出与 Schema 不匹配",
        safe.error,
      );
    }
    return safe.data;
  }

  streamText(input: StreamTextInput): StreamTextHandle {
    const cfg = getServerAIConfig();
    const { controller, clear } = createAbortController(input.timeoutMs, input.signal);
    let aborted = false;
    let resolveText!: (value: string) => void;
    let rejectText!: (err: Error) => void;
    const textPromise = new Promise<string>((resolve, reject) => {
      resolveText = resolve;
      rejectText = reject;
    });

    const url = `${cfg.deepseekBaseUrl.replace(/\/+$/, "")}/chat/completions`;
    const body: ChatCompletionsRequest = {
      model: input.model || cfg.deepseekModel,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      stream: true,
    };

    void (async () => {
      try {
        if (!cfg.deepseekApiKey) {
          rejectText(new ProviderError("PROVIDER_UNAVAILABLE", "DeepSeek API Key 未配置"));
          return;
        }
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cfg.deepseekApiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          rejectText(
            new ProviderError(
              res.status === 401 || res.status === 403
                ? "PROVIDER_AUTH_FAILED"
                : "PROVIDER_HTTP_ERROR",
              `DeepSeek 调用失败 (${res.status})`,
              text.slice(0, 500),
            ),
          );
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as ChatCompletionsChoice;
              const chunk = parsed?.delta?.content;
              if (chunk) accumulated += chunk;
            } catch {
              /* ignore malformed SSE line */
            }
          }
        }
        resolveText(accumulated);
      } catch (err) {
        if (controller.signal.aborted && !aborted) {
          rejectText(new ProviderError("PROVIDER_TIMEOUT", "DeepSeek 调用超时"));
        } else if (err instanceof Error) {
          rejectText(new ProviderError("PROVIDER_NETWORK_ERROR", err.message, err));
        } else {
          rejectText(new ProviderError("PROVIDER_UNKNOWN", "未知错误"));
        }
      } finally {
        clear();
      }
    })();

    return {
      text: () => textPromise,
      abort: () => {
        aborted = true;
        controller.abort(new Error("USER_CANCELLED"));
      },
    };
  }
}

/* ---------- Factory ---------- */

let singleton: LanguageModelProvider | null = null;

/** 获取 Provider Adapter 单例。不可用时仍可调用 generateObject / streamText，但会立即抛错。 */
export function getLanguageModelProvider(): LanguageModelProvider {
  if (!singleton) {
    singleton = new DeepSeekProvider();
  }
  return singleton;
}

/** 测试钩子：重置单例以便使用 mock。 */
export function __setLanguageModelProviderForTests(p: LanguageModelProvider | null): void {
  singleton = p;
}

/** Zod Schema → 抽象 ZodLike（用于 Provider Adapter 接受任意 Zod schema）。 */
export function asZodLike<T>(schema: z.ZodType<T>) {
  return {
    parse: (input: unknown) => schema.parse(input) as T,
    safeParse: (input: unknown) => schema.safeParse(input) as
      | { success: true; data: T }
      | { success: false; error: z.ZodError },
  };
}
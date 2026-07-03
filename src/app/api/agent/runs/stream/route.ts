/**
 * Route Handler: 启动 Workflow Run 并以 Server-Sent Events 流式返回事件。
 *
 * GET /api/agent/runs/stream?preset=...&input=<json>
 *
 * 行为：
 * - 启动一个新的 Workflow Run；
 * - 把每个 WorkflowEvent 通过 SSE 实时推送给客户端（不等待 run 完成）；
 * - 客户端断开连接时，Abort run（防止无效 AI 调用）；
 * - 超时（AI_REQUEST_TIMEOUT_MS）触发 → 自动降级；
 * - 模型调用失败 → 自动降级到 Demo Replay；
 * - 前端可通过 GET /api/agent/runs/[id] 查询已完成 Run 的最终状态（恢复）。
 *
 * 服务端 only；禁止直接暴露 API Key / Prompt 全文。
 */

import { NextRequest } from "next/server";

import { runWorkflow } from "@/modules/agent-runtime/core/orchestrator";
import { getRunRepository } from "@/modules/agent-runtime/core/run-repository";
import { WorkflowEventBus } from "@/modules/agent-runtime/core/event-bus";
import { getServerAIConfig } from "@/modules/agent-runtime/server/server-config";
import { getLanguageModelProvider } from "@/modules/agent-runtime/server/provider";
import {
  blastScenarioInputSchema,
  type BlastScenarioInput,
} from "@/modules/parameter-planning/domain/contracts";
import type { WorkflowEvent } from "@/modules/agent-runtime/core/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function newRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function newRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const cfg = getServerAIConfig();
  const provider = getLanguageModelProvider();
  const url = new URL(req.url);
  const presetId = url.searchParams.get("preset") ?? undefined;
  const inputRaw = url.searchParams.get("input");
  const runIdFromClient = url.searchParams.get("runId") ?? newRunId();
  const forceReplay = url.searchParams.get("replay") === "1" || !provider.isAvailable;

  if (!inputRaw) {
    return new Response(
      sseData({ type: "error", code: "MISSING_INPUT", message: "缺少 input 参数" }),
      {
        status: 400,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
        },
      },
    );
  }

  let parsedInput: BlastScenarioInput;
  try {
    const json = JSON.parse(decodeURIComponent(inputRaw));
    const safe = blastScenarioInputSchema.safeParse(json);
    if (!safe.success) {
      return new Response(
        sseData({
          type: "error",
          code: "VALIDATION_ERROR",
          message: "输入校验失败",
          details: safe.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
          },
        },
      );
    }
    parsedInput = safe.data;
  } catch (err) {
    return new Response(
      sseData({
        type: "error",
        code: "INPUT_PARSE_ERROR",
        message: err instanceof Error ? err.message : "parse failed",
      }),
      {
        status: 400,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
        },
      },
    );
  }

  const repo = getRunRepository();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (payload: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseData(payload)));
        } catch {
          closed = true;
        }
      };

      const ac = new AbortController();
      const onAbort = (): void => {
        repo.cancel(runIdFromClient);
        try {
          ac.abort(new Error("CLIENT_DISCONNECT"));
        } catch {
          /* ignore */
        }
      };
      req.signal.addEventListener("abort", onAbort);

      // 事件总线：边执行边推送
      const bus = new WorkflowEventBus();

      // 订阅实时事件
      const unsubscribe = bus.on("*", (evt: WorkflowEvent) => {
        send({ type: "workflow.event", event: evt });
      });

      try {
        send({
          type: "meta",
          runId: runIdFromClient,
          replay: forceReplay,
          model: cfg.deepseekModel,
          providerAvailable: provider.isAvailable,
          demoReplayEnabled: cfg.demoReplayEnabled,
        });

        // 在事件循环的下一个 tick 启动 Workflow，避免 send 未生效
        const result = await runWorkflow({
          runId: runIdFromClient,
          workflowId: "main",
          ...(presetId ? { presetId } : {}),
          input: parsedInput,
          requestId: newRequestId(),
          forceReplay,
          abortSignal: ac.signal,
          bus,
        });

        // 写入输入供后续 convert 使用
        repo.setInput(runIdFromClient, parsedInput);

        // 若客户端已经断开，避免再发送 summary
        if (!closed) {
          send({
            type: "workflow.summary",
            run: result.run,
            traces: result.traces,
            replay: result.replay,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Workflow 执行失败";
        const code = (err as { code?: string }).code ?? "WORKFLOW_FAILED";
        send({ type: "workflow.failed", code, message });
      } finally {
        unsubscribe();
        req.signal.removeEventListener("abort", onAbort);
        if (!closed) {
          try {
            controller.close();
            closed = true;
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
/**
 * Workflow Event 类型化封装 + EventEmitter。
 *
 * EventEmitter 提供：
 * - on(type, handler)：订阅
 * - emit(event)：发布（内部使用）
 * - replayAll()：回放全部历史事件（用于断线恢复 / Replay 模式）
 * - clear()：重置
 */

import type { WorkflowEvent } from "./contracts";

type Handler = (event: WorkflowEvent) => void;
const ALL_TYPES = "*" as const;

export class WorkflowEventBus {
  private handlers: Map<string | typeof ALL_TYPES, Set<Handler>> = new Map();
  private history: WorkflowEvent[] = [];
  private sequence = 0;

  on(type: WorkflowEvent["type"] | typeof ALL_TYPES, handler: Handler): () => void {
    const set = this.handlers.get(type) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      const s = this.handlers.get(type);
      if (s) s.delete(handler);
    };
  }

  emit(event: Omit<WorkflowEvent, "eventId" | "sequence"> & { payload: unknown }): WorkflowEvent {
    this.sequence += 1;
    const full = { ...event, eventId: `evt-${Date.now().toString(36)}-${this.sequence.toString(36)}`, sequence: this.sequence } as WorkflowEvent;
    this.history.push(full);
    const typed = this.handlers.get(full.type);
    if (typed) for (const h of typed) h(full);
    const all = this.handlers.get(ALL_TYPES);
    if (all) for (const h of all) h(full);
    return full;
  }

  /** 获取所有历史事件（按 sequence 升序）。 */
  historyAll(): readonly WorkflowEvent[] {
    return [...this.history].sort((a, b) => a.sequence - b.sequence);
  }

  clear(): void {
    this.history = [];
    this.sequence = 0;
  }
}
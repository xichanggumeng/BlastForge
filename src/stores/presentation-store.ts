"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Presentation / 大屏展示模式 状态。
 *
 * Phase 5 / Session 2 启用：
 * - `enabled`: 是否进入大屏模式；
 * - `toggle()` / `setEnabled()`: 切换状态；
 * - 状态通过 `localStorage` 持久化，刷新页面后保持一致。
 *
 * 默认 false。会议演示时通过 PresentationShell 提供的按钮开启。
 */

interface PresentationState {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
}

export const usePresentationStore = create<PresentationState>()(
  persist(
    (set, get) => ({
      enabled: false,
      setEnabled: (next) => set({ enabled: next }),
      toggle: () => set({ enabled: !get().enabled }),
    }),
    {
      name: "blastforge.presentation",
      version: 1,
    },
  ),
);
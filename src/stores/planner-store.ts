/**
 * 参数规划工作区 - Zustand 切片。
 *
 * 包含：
 * - `useSelection`: 当前选中的 Run / Scheme；
 * - `useUI`: 当前 step、移动端 step 状态、面板折叠状态；
 * - 不缓存整个 Run 对象，避免与未来 Server Action 数据冲突；
 * - 不存储草稿表单（草稿由 React Hook Form 自行管理）。
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SelectionState {
  selectedSchemeId: string | null;
  setSelectedSchemeId: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set) => ({
      selectedSchemeId: null,
      setSelectedSchemeId: (id) => set({ selectedSchemeId: id }),
    }),
    {
      name: "blastforge.planner.selection",
      version: 1,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
    },
  ),
);

interface UIState {
  /** 当前移动端 step（0-based） */
  mobileStep: number;
  setMobileStep: (step: number) => void;

  /** 桌面侧详情面板展开状态 */
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  toggleDetails: () => void;

  /** 当前展示图表 tab（radar / bar / heatmap） */
  chart: "radar" | "bar" | "heatmap";
  setChart: (chart: UIState["chart"]) => void;

  reset: () => void;
}

const UI_DEFAULT: Pick<UIState, "mobileStep" | "detailsOpen" | "chart"> = {
  mobileStep: 0,
  detailsOpen: true,
  chart: "radar",
};

export const usePlannerUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      ...UI_DEFAULT,
      setMobileStep: (step) => set({ mobileStep: Math.max(0, step) }),
      setDetailsOpen: (open) => set({ detailsOpen: open }),
      toggleDetails: () => set({ detailsOpen: !get().detailsOpen }),
      setChart: (chart) => set({ chart }),
      reset: () => set(UI_DEFAULT),
    }),
    {
      name: "blastforge.planner.ui",
      version: 1,
      partialize: (state) => ({
        chart: state.chart,
        detailsOpen: state.detailsOpen,
      }),
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
    },
  ),
);

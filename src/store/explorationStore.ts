/**
 * 推演分支容器（stage-08 T1）
 *
 * 职责：承载**会话内存**的走向意向、温度集与推演分支（`ExplorationBranch`）。
 * **不落库**；与其它 store **各自独立 `create()`**。
 */

import { create } from "zustand";
import { DEFAULT_TEMPERATURES } from "@/orchestration/exploration/temperature";
import type { ExplorationBranch } from "@/orchestration/exploration/types";

interface ExplorationState {
  /** 走向意向（user 段） */
  intent: string;
  /** 温度集 */
  temperatures: number[];
  /** 推演分支（会话内存） */
  branches: ExplorationBranch[];
  /** 是否正在运行 */
  running: boolean;
  setIntent: (intent: string) => void;
  setTemperatures: (temperatures: number[]) => void;
  setBranches: (branches: ExplorationBranch[]) => void;
  updateBranch: (id: string, patch: Partial<ExplorationBranch>) => void;
  setRunning: (running: boolean) => void;
  clear: () => void;
}

/** 推演元状态（会话内存；独立 `create`） */
export const useExplorationStore = create<ExplorationState>((set) => ({
  intent: "",
  temperatures: [...DEFAULT_TEMPERATURES],
  branches: [],
  running: false,
  setIntent: (intent) => set({ intent }),
  setTemperatures: (temperatures) => set({ temperatures }),
  setBranches: (branches) => set({ branches }),
  updateBranch: (id, patch) =>
    set((state) => ({
      branches: state.branches.map((branch) =>
        branch.id === id ? { ...branch, ...patch } : branch,
      ),
    })),
  setRunning: (running) => set({ running }),
  // 清空分支与运行态（保留意向与温度配置）
  clear: () => set({ branches: [], running: false }),
}));

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
  /** 选中的分支（对比视图） */
  selectedBranchId: string | null;
  /** 折叠的分支 id（对比视图） */
  collapsedIds: string[];
  setIntent: (intent: string) => void;
  setTemperatures: (temperatures: number[]) => void;
  setBranches: (branches: ExplorationBranch[]) => void;
  updateBranch: (id: string, patch: Partial<ExplorationBranch>) => void;
  setRunning: (running: boolean) => void;
  /** 选中分支（再次点击同分支 → 取消选中） */
  selectBranch: (id: string) => void;
  /** 折叠/展开分支 */
  toggleCollapsed: (id: string) => void;
  /** 丢弃分支（会话容器移除；选中/折叠状态一并清理） */
  removeBranch: (id: string) => void;
  clear: () => void;
}

/** 推演元状态（会话内存；独立 `create`） */
export const useExplorationStore = create<ExplorationState>((set) => ({
  intent: "",
  temperatures: [...DEFAULT_TEMPERATURES],
  branches: [],
  running: false,
  selectedBranchId: null,
  collapsedIds: [],
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
  selectBranch: (id) =>
    set((state) => ({ selectedBranchId: state.selectedBranchId === id ? null : id })),
  toggleCollapsed: (id) =>
    set((state) => ({
      collapsedIds: state.collapsedIds.includes(id)
        ? state.collapsedIds.filter((current) => current !== id)
        : [...state.collapsedIds, id],
    })),
  removeBranch: (id) =>
    set((state) => ({
      branches: state.branches.filter((branch) => branch.id !== id),
      // 选中已移除分支 → 清空（避免悬空引用）
      selectedBranchId: state.selectedBranchId === id ? null : state.selectedBranchId,
      collapsedIds: state.collapsedIds.filter((current) => current !== id),
    })),
  // 清空分支、选中与折叠态（保留意向与温度配置）
  clear: () => set({ branches: [], running: false, selectedBranchId: null, collapsedIds: [] }),
}));

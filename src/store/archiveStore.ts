/**
 * 归档抽取待确认队列（stage-11 T2）
 *
 * 职责：承载**会话内存**的抽取候选（`ExtractionCandidate`）——**不落库直达**；
 * 用户确认（并可按需修正分级/内容）后由 `saveExtracted` 批量落库。
 * 与其它 store **各自独立 `create()`**。
 */

import { create } from "zustand";
import type { ExtractionCandidate } from "@/orchestration/consistency/types";

interface ArchiveState {
  /** 待确认候选（会话内存） */
  candidates: ExtractionCandidate[];
  /** 覆盖候选列表（重新抽取 / 运行结束） */
  setCandidates: (candidates: ExtractionCandidate[]) => void;
  /** 修正单条候选（分级 / 内容等）；越界索引忽略 */
  updateCandidate: (index: number, patch: Partial<ExtractionCandidate>) => void;
  /** 移除单条候选（用户剔除）；越界索引忽略 */
  removeCandidate: (index: number) => void;
  /** 清空候选（落库成功后） */
  clear: () => void;
}

/** 归档待确认队列（会话内存；独立 `create`） */
export const useArchiveStore = create<ArchiveState>((set) => ({
  candidates: [],
  setCandidates: (candidates) => set({ candidates }),
  updateCandidate: (index, patch) =>
    set((state) => {
      if (index < 0 || index >= state.candidates.length) {
        return state;
      }
      const candidates = state.candidates.map((candidate, current) =>
        current === index ? { ...candidate, ...patch } : candidate,
      );
      return { candidates };
    }),
  removeCandidate: (index) =>
    set((state) => {
      if (index < 0 || index >= state.candidates.length) {
        return state;
      }
      return { candidates: state.candidates.filter((_, current) => current !== index) };
    }),
  clear: () => set({ candidates: [] }),
}));

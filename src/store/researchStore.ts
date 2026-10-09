/**
 * 研究/采样会话状态（stage-07 T1）
 *
 * 职责：承载研究工作的**会话级**状态——参与采样的 `model_config` 勾选与**素材候选**。
 * 与 `editorStore` / `generationStore` / `reviewStore` **各自独立 `create()`**；**不持久化**。
 */

import { create } from "zustand";
import type { MaterialCandidate } from "@/orchestration/research/types";

interface ResearchState {
  /** 勾选的 `model_config.id`（≥1 才可采样） */
  selectedConfigIds: number[];
  /** 素材候选（会话内存；T3 标记后入库） */
  candidates: MaterialCandidate[];
  setSelectedConfigIds: (ids: number[]) => void;
  addCandidate: (candidate: MaterialCandidate) => void;
  clearCandidates: () => void;
}

/** 研究元状态（勾选 + 候选；独立 `create`，不持正文） */
export const useResearchStore = create<ResearchState>((set) => ({
  selectedConfigIds: [],
  candidates: [],
  setSelectedConfigIds: (selectedConfigIds) => set({ selectedConfigIds }),
  // 采样中增量入池；**停止采样时已采集候选保留**（不在此清理）
  addCandidate: (candidate) => set((state) => ({ candidates: [...state.candidates, candidate] })),
  clearCandidates: () => set({ candidates: [] }),
}));

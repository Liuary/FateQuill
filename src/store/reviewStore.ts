/**
 * 审查元状态 store（stage-06 T3）
 *
 * 职责：承载**会话级版本池**（初版 + 重写轮次产物）、用户可调权重与自动重写开关。
 * 与 `editorStore` / `generationStore` **各自独立 `create()`**（互不 setState）；
 * 正文事实源仍在 Tiptap 实例，采纳由 `EditorController.replaceContent` 落地。
 */

import { create } from "zustand";
import {
  DEFAULT_WEIGHTS,
  weightedTotal,
  type EvaluationBundle,
  type ReviewWeights,
} from "@/orchestration/review/aggregate";

/** 版本池条目：一次生成/重写的产物与四维评估结果 */
export interface ReviewVersion {
  id: string;
  label: string;
  content: string;
  round: number;
  results: EvaluationBundle;
  /** 按当前权重算出的加权总分（`setWeights` 时重算） */
  totalScore: number;
}

interface ReviewState {
  versions: ReviewVersion[];
  weights: ReviewWeights;
  activeVersionId: string | null;
  /** 自动重写（默认开；成本控制可关） */
  autoRewrite: boolean;
  /** 自动重写最大轮次 */
  maxRounds: number;
  addVersion: (v: Omit<ReviewVersion, "totalScore">) => void;
  setWeights: (w: ReviewWeights) => void;
  setActive: (id: string) => void;
  setAutoRewrite: (b: boolean) => void;
  clear: () => void;
}

/** 版本池初始态（会话级） */
function initialState() {
  return {
    versions: [] as ReviewVersion[],
    weights: { ...DEFAULT_WEIGHTS },
    activeVersionId: null as string | null,
    autoRewrite: true,
    maxRounds: 2,
  };
}

/** 审查元状态（版本池 + 权重 + 开关；独立 `create`，不持正文） */
export const useReviewStore = create<ReviewState>((set) => ({
  ...initialState(),
  addVersion: (v) =>
    set((state) => ({
      // 非最优版本一并保留在池中（可回看）
      versions: [...state.versions, { ...v, totalScore: weightedTotal(v.results, state.weights) }],
    })),
  // 权重变更：重算全部版本总分（排序随之变化）
  setWeights: (weights) =>
    set((state) => ({
      weights,
      versions: state.versions.map((v) => ({
        ...v,
        totalScore: weightedTotal(v.results, weights),
      })),
    })),
  setActive: (id) => set({ activeVersionId: id }),
  setAutoRewrite: (autoRewrite) => set({ autoRewrite }),
  // 清空版本池与选中态（保留用户权重与开关）
  clear: () =>
    set((state) => ({
      versions: [],
      activeVersionId: null,
      weights: state.weights,
      autoRewrite: state.autoRewrite,
      maxRounds: state.maxRounds,
    })),
}));

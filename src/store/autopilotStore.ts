/**
 * 全自动创作进度态（stage-12 T2）
 *
 * 职责：承载**会话内存**的全自动进度与报告（`status` / 当前章 / 各章结果 / 整轮报告）。
 * **不落库**（断点落库见 op-004）；与其它 store **各自独立 `create()`**（**状态单源**，kb 收口清单 #4）。
 */

import { create } from "zustand";
import type {
  AutopilotProgress,
  ChapterOutcome,
  RunOutcome,
} from "@/orchestration/autopilot/types";

interface AutopilotState {
  /** 运行状态 */
  status: AutopilotProgress["status"];
  /** 当前章下标（0 起；`-1` = 未开始） */
  currentIndex: number;
  /** 大纲章数 */
  total: number;
  /** 已完成章结果 */
  chapters: ChapterOutcome[];
  /** 整轮报告（结束时可读） */
  report: RunOutcome | null;
  /** 「冲突策略」授权开关（**单源**；`false` = 默认「暂停 + 通知」，`true` = 用户显式授权「自动忽略继续」） */
  autoIgnoreConflicts: boolean;
  setStatus: (status: AutopilotProgress["status"]) => void;
  /** 覆盖式写入进度（与 `runAutopilot` 的 `onProgress` 对齐；幂等） */
  setProgress: (progress: AutopilotProgress) => void;
  /** 追加单章结果 */
  appendChapter: (chapter: ChapterOutcome) => void;
  setReport: (report: RunOutcome | null) => void;
  /** 设置「冲突策略」授权开关（默认 `false`：暂停 + 通知） */
  setAutoIgnoreConflicts: (value: boolean) => void;
  reset: () => void;
}

/** 全自动进度态（会话内存；独立 `create`） */
export const useAutopilotStore = create<AutopilotState>((set) => ({
  status: "idle",
  currentIndex: -1,
  total: 0,
  chapters: [],
  report: null,
  autoIgnoreConflicts: false, // **缺省关闭**：默认「暂停 + 通知」，保留用户终裁决
  setStatus: (status) => set({ status }),
  setProgress: (progress) =>
    set({
      status: progress.status,
      currentIndex: progress.currentIndex,
      total: progress.total,
      chapters: progress.chapters,
    }),
  appendChapter: (chapter) => set((state) => ({ chapters: [...state.chapters, chapter] })),
  setReport: (report) => set({ report }),
  setAutoIgnoreConflicts: (value) => set({ autoIgnoreConflicts: value }),
  reset: () => set({ status: "idle", currentIndex: -1, total: 0, chapters: [], report: null }),
}));

import { create } from "zustand";
import type { IpcError } from "@/ipc/errors";

export type GenerationStatus = "idle" | "streaming" | "done" | "error" | "aborted";

interface GenerationState {
  status: GenerationStatus;
  chapterId: number | null;
  requestId: string | null; // 生成会话关联 id（非底层 requestId）
  progress: { chars: number };
  error: IpcError | null;
  begin: (chapterId: number, requestId: string) => void;
  advance: (chars: number) => void;
  finish: () => void;
  fail: (error: IpcError) => void;
  reset: () => void; // 半态复位：status=idle、requestId=null、error 保留或清空
}

/** 生成元状态（不持正文；正文事实源在 Tiptap 实例）；与 editorStore 独立（C-03） */
export const useGenerationStore = create<GenerationState>((set) => ({
  status: "idle",
  chapterId: null,
  requestId: null,
  progress: { chars: 0 },
  error: null,
  begin: (chapterId, requestId) =>
    set({ status: "streaming", chapterId, requestId, progress: { chars: 0 }, error: null }),
  advance: (chars) => set({ progress: { chars } }),
  finish: () => set({ status: "done" }),
  // 失败/停止后**收敛态 = idle**（DoD：「停止/失败后 status=idle 且无悬挂 requestId」）；error 仅用于展示
  fail: (error) => set({ status: "idle", error, requestId: null }),
  reset: () => set({ status: "idle", requestId: null, error: null }),
}));

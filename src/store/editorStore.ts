import { create } from "zustand";

export type SaveStatus = "saved" | "saving" | "dirty" | "error";

interface EditorState {
  currentNovelId: number | null;
  currentChapterId: number | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  setCurrentNovel: (id: number | null) => void;
  setCurrentChapter: (id: number | null) => void;
  setSaveStatus: (s: SaveStatus) => void;
  markSaved: () => void;
}

/** 编辑器元状态（单一事实源原则：不持有 ProseMirror 文档内容，正文在 Tiptap 实例） */
export const useEditorStore = create<EditorState>((set) => ({
  currentNovelId: null,
  currentChapterId: null,
  saveStatus: "saved",
  lastSavedAt: null,
  setCurrentNovel: (id) => set({ currentNovelId: id }),
  setCurrentChapter: (id) => set({ currentChapterId: id }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  markSaved: () => set({ saveStatus: "saved", lastSavedAt: Date.now() }),
}));

/**
 * 对话 / 旁白条目容器（stage-10 T2）
 *
 * **会话内存**（同 stage-08 `explorationStore` 范式：独立 `create()`、**无持久化**）；
 * `orderIndex` 由 store **恒维护为连续 `0..n-1`**（增删/移动/插入后自动重排）。
 *
 * 对话历史**不落库**（方案 A）；合并后的正文才是资产（op-004）。
 */

import { create } from "zustand";
import type { DialogueEntry, DialogueEntryKind } from "@/orchestration/dialogue/types";

/** 新增条目的入参（`id`/`orderIndex` 由 store 分配） */
export interface NewDialogueEntry {
  kind: DialogueEntryKind;
  speakerId?: number;
  speakerName?: string;
  content: string;
  id?: string;
}

interface DialogueState {
  entries: DialogueEntry[];
  running: boolean;
  addEntry: (entry: NewDialogueEntry) => DialogueEntry;
  insertAt: (index: number, entry: NewDialogueEntry) => DialogueEntry;
  updateEntry: (id: string, patch: Partial<Pick<DialogueEntry, "content" | "speakerName">>) => void;
  removeEntry: (id: string) => void;
  /** 与相邻条目交换（`dir=-1` 上移 / `1` 下移） */
  moveEntry: (id: string, dir: -1 | 1) => void;
  setRunning: (value: boolean) => void;
  /** 清空条目（保持空列表） */
  clear: () => void;
}

/** 重排 `orderIndex` 为连续 `0..n-1` */
const reindex = (entries: DialogueEntry[]): DialogueEntry[] =>
  entries.map((entry, index) => ({ ...entry, orderIndex: index }));

/** 新条目 id */
const newId = (): string => crypto.randomUUID();

/** 对话条目容器（会话内存；独立 `create`，**无持久化**） */
export const useDialogueStore = create<DialogueState>((set, get) => ({
  entries: [],
  running: false,
  addEntry: (entry) => {
    const created: DialogueEntry = {
      ...entry,
      id: entry.id ?? newId(),
      orderIndex: get().entries.length,
    };
    set((state) => ({ entries: reindex([...state.entries, created]) }));
    return created;
  },
  insertAt: (index, entry) => {
    const created: DialogueEntry = { ...entry, id: entry.id ?? newId(), orderIndex: 0 };
    set((state) => {
      const next = [...state.entries];
      const at = Math.max(0, Math.min(index, next.length));
      next.splice(at, 0, created);
      return { entries: reindex(next) };
    });
    return created;
  },
  updateEntry: (id, patch) =>
    set((state) => ({
      entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    })),
  removeEntry: (id) =>
    set((state) => ({ entries: reindex(state.entries.filter((entry) => entry.id !== id)) })),
  moveEntry: (id, dir) =>
    set((state) => {
      const index = state.entries.findIndex((entry) => entry.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= state.entries.length) {
        return { entries: state.entries }; // 越界：原样（顺序仍连续）
      }
      const next = [...state.entries];
      [next[index], next[target]] = [next[target], next[index]];
      return { entries: reindex(next) };
    }),
  setRunning: (running) => set({ running }),
  clear: () => set({ entries: [], running: false }),
}));

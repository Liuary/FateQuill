import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { Chapter } from "@/domain/models/chapter";
import { repositories } from "@/ipc/repositories";
import { useEditorStore } from "@/store/editorStore";

const DEBOUNCE_MS = 800;
const RETRY_MS = 5000;
const MAX_RETRY = 5;

export interface AutoSaveMeta {
  title: string;
  status: Chapter["status"];
  orderIndex: number;
}

/** 模块级「当前编辑器 flush」句柄，供窗口关闭时调用 */
let globalFlush: (() => Promise<boolean>) | null = null;

/** 自动保存：防抖 800ms；失败置脏并 5s 重试（线性退避/上限）；保存串行化（REV-011）；暴露 flush() */
export function useAutoSave(editor: Editor | null, chapterId: number | null, meta: AutoSaveMeta) {
  const { setSaveStatus, markSaved } = useEditorStore.getState();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef(0);
  const dirtyRef = useRef(false);
  const chainRef = useRef<Promise<void>>(Promise.resolve()); // 保存串行化链（REV-011）
  const enqueueRef = useRef<() => Promise<void>>(async () => {}); // 自引用（重试）间接调用
  const chapterIdRef = useRef(chapterId); // 章号守卫：旧实例闭包不回写当前章

  useEffect(() => {
    chapterIdRef.current = chapterId;
  }, [chapterId]);

  /**
   * 串行化保存（REV-011）：所有保存串到同一条 promise 链 → 后写必然在前写完成后执行，
   * 且执行时**重新取 `editor.getHTML()`**（最新内容优先）。
   * 脏标在 `await` **之前**清除：保存期间的再次编辑会重新置脏，从而触发后续保存（旧写不吞新写）。
   */
  const enqueueSave = useCallback((): Promise<void> => {
    chainRef.current = chainRef.current.then(async () => {
      if (editor == null || chapterId == null || !dirtyRef.current) return;
      // 章号守卫：若当前活动章已变，旧实例闭包跳过，避免误写当前章（BUG-001 加固）
      if (chapterIdRef.current !== chapterId) return;
      setSaveStatus("saving");
      dirtyRef.current = false; // 先清脏标（保存期间的新编辑会重新置真）
      try {
        await repositories.chapter.update(chapterId, {
          title: meta.title,
          content: editor.getHTML(),
          contentFormat: "html",
          status: meta.status,
          orderIndex: meta.orderIndex,
        });
        retry.current = 0;
        if (dirtyRef.current) {
          setSaveStatus("dirty"); // 保存期间又有变更，保留脏态
        } else {
          markSaved();
        }
      } catch {
        dirtyRef.current = true; // 失败保留脏态，不静默丢弃
        setSaveStatus("dirty");
        if (retry.current < MAX_RETRY) {
          const delay = RETRY_MS * (retry.current + 1); // 线性退避
          retry.current += 1;
          setTimeout(() => {
            void enqueueRef.current();
          }, delay);
        } else {
          setSaveStatus("error");
        }
      }
    });
    return chainRef.current;
  }, [editor, chapterId, meta.title, meta.status, meta.orderIndex, setSaveStatus, markSaved]);

  useEffect(() => {
    enqueueRef.current = enqueueSave;
  }, [enqueueSave]);

  /** 立即保存并返回成功态：无脏→true；保存成功→true；保存失败→false（仍置脏 + 重试，不静默丢弃） */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await enqueueSave();
    return !dirtyRef.current;
  }, [enqueueSave]);

  /** 文档变更：置脏 + 重置防抖计时 */
  const schedule = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void enqueueSave();
    }, DEBOUNCE_MS);
  }, [enqueueSave, setSaveStatus]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", schedule);
    return () => {
      editor.off("update", schedule);
    };
  }, [editor, schedule]);

  useEffect(() => {
    globalFlush = flush;
    return () => {
      if (globalFlush === flush) globalFlush = null;
    };
  }, [flush]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { flush, saveNow: enqueueSave };
}

/** 窗口关闭前 flush：Tauri `onCloseRequested`（preventDefault → flush → destroy）+ Web `beforeunload` 兜底 */
export function useFlushOnClose() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    if (isTauri) {
      void (async () => {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const un = await win.onCloseRequested(async (event) => {
          event.preventDefault();
          if (globalFlush) await globalFlush();
          await win.destroy();
        });
        if (disposed) un();
        else unlisten = un;
      })();
    }

    const onBeforeUnload = () => {
      void globalFlush?.();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
}

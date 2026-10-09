import type { Editor } from "@tiptap/react";

/**
 * appendChunk options：
 * - follow：插入后是否滚动到文末（默认 false）。
 * - addToHistory：**预留字段**；当前实现恒入历史（由编辑器 `newGroupDelay=5000` 合并为单条，REV-009），暂不生效。
 */
export interface AppendOptions {
  addToHistory?: boolean;
  follow?: boolean;
}

export interface EditorController {
  appendChunk(text: string, options?: AppendOptions): void;
  flushPending(): void;
  dispose(): void; // 卸载时移除 DOM 监听（REV-010）
}

/** 构造编辑器增量插入控制器（节流批次 + 撤销分组合并 + DOM 级 IME 排队） */
export function createEditorController(
  editor: Editor,
  opts?: { throttleMs?: number },
): EditorController {
  const throttleMs = opts?.throttleMs ?? 50;
  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let composing = false;
  let follow = false;

  const apply = () => {
    timer = null;
    if (!buffer || composing) return; // 组合期间排队，compositionend 后 flush
    // 默认入历史（不设 addToHistory:false）；由 newGroupDelay=5000 合并为单条（REV-009）
    const tr = editor.state.tr.insertText(buffer, editor.state.doc.content.size);
    editor.view.dispatch(tr);
    buffer = "";
    if (follow) editor.commands.scrollIntoView();
  };

  // IME：监听 ProseMirror 视图 DOM —— Tiptap editor 事件总线不含 composition 事件（REV-010）
  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
    if (buffer) apply();
  };
  editor.view.dom.addEventListener("compositionstart", onCompositionStart);
  editor.view.dom.addEventListener("compositionend", onCompositionEnd);

  return {
    appendChunk(text, options) {
      if (options?.follow !== undefined) follow = options.follow;
      buffer += text;
      if (timer == null) timer = setTimeout(apply, throttleMs);
    },
    flushPending() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      apply();
    },
    dispose() {
      if (timer) clearTimeout(timer);
      editor.view.dom.removeEventListener("compositionstart", onCompositionStart);
      editor.view.dom.removeEventListener("compositionend", onCompositionEnd);
    },
  };
}

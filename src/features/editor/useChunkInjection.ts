import type { Editor } from "@tiptap/react";
import type { Chunk } from "@/orchestration/types";
import { subscribeChunks } from "@/orchestration/stream";
import { createEditorController } from "./EditorController";

/** 订阅 Chunk 异步流 → 经节流 → 增量插入编辑器；返回取消函数 */
export function injectChunkStream(editor: Editor, source: AsyncIterable<Chunk>): () => void {
  const controller = createEditorController(editor);
  let cancelled = false;
  void (async () => {
    for await (const chunk of subscribeChunks(source)) {
      // 复用 stage-03 节流（≥50ms 合并）
      if (cancelled) return;
      controller.appendChunk(chunk.delta);
    }
    controller.flushPending();
  })();
  return () => {
    cancelled = true;
  };
}

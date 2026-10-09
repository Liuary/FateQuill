import { useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { ModelConfig } from "@/domain/models/model-config";
import { parseIpcError } from "@/ipc/errors";
import { subscribeChunks } from "@/orchestration/stream";
import { createEditorController } from "@/features/editor/EditorController";
import { useGenerationStore } from "@/store/generationStore";
import { buildChapterGenerationOptions } from "./build-chapter-options";
import { resolveProviderForConfig } from "./resolve-provider";

export interface StartGenerationParams {
  novelId: number;
  chapterId: number;
  userInstruction: string;
  config: ModelConfig;
}

/** 生成编排（模式 A 流式直插）：装配 ChatOptions → provider.stream → subscribeChunks → EditorController.appendChunk */
export function useGeneration(editor: Editor | null) {
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (p: StartGenerationParams) => {
      if (!editor) return;
      const options = await buildChapterGenerationOptions({
        novelId: p.novelId,
        chapterId: p.chapterId,
        userInstruction: p.userInstruction,
        model: p.config.modelName,
        temperature: p.config.temperature,
      });
      const provider = resolveProviderForConfig(p.config);
      const abort = new AbortController();
      abortRef.current = abort;
      const controller = createEditorController(editor);
      const g = useGenerationStore.getState();
      g.begin(p.chapterId, crypto.randomUUID());
      let chars = 0;
      try {
        const source = provider.stream({ ...options, signal: abort.signal });
        for await (const chunk of subscribeChunks(source)) {
          // stage-03 节流(≥50ms)
          if (abort.signal.aborted) break;
          controller.appendChunk(chunk.delta); // stage-04 直插（恒入历史/合并）
          chars += chunk.delta.length;
          g.advance(chars);
        }
        controller.flushPending(); // 应用队列残留（保留草稿）
        // 停止（aborted）与正常完成均收敛 generationStore，不留半态（REV-006/008）
        if (abort.signal.aborted)
          g.reset(); // 停止 → status=idle + requestId=null
        else g.finish(); // 正常 → done
      } catch (e) {
        controller.flushPending(); // 失败亦保留已插入草稿
        g.fail(parseIpcError(e)); // 失败 → status=idle + error（无悬挂 requestId）
      } finally {
        controller.dispose();
        abortRef.current = null; // 无悬挂 abort 句柄
      }
    },
    [editor],
  );

  /** 用户停止：仅触发 abort（→ provider/transport 中断）；状态收敛由 start 收口 */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { start, stop, abortRef };
}

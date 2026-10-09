/**
 * 合并落章双路径编排（stage-10 T3）
 *
 * **复用 stage-08 REV-007 安全网范式**：
 * - **主路径** `mergeAsNextChapter`：`chapter.create`（追加当前卷末，**不改当前章** → 无 DB 丢失风险）；
 * - **次路径（危险）** `replaceCurrentChapter`：**强制入池快照（必做）**（`reviewStore.addVersion`，
 *   label `dialogue-merge-safety`）→ `EditorController.replaceContent`（**单条撤销**）→ `dispose()`；
 *   调用方负责**二次确认**（`ConfirmInline`）。
 *
 * **无 IPC 增量**：仅复用既有 `chapter` 仓储命令与前端 `EditorController` 命令面。
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { repositories } from "@/ipc/repositories";
import { assembleDialogueHtml } from "@/orchestration/dialogue/assemble";
import { createEditorController } from "@/features/editor/EditorController";
import { useReviewStore } from "@/store/reviewStore";
import { useDialogueStore } from "@/store/dialogueStore";

/** 合并落章编排 */
export function useMergeDialogue(editor: Editor | null) {
  const { t } = useTranslation("dialogue");
  const entries = useDialogueStore((s) => s.entries);
  const [error, setError] = useState<string | null>(null);

  /** 主路径：新建下一章草稿（**不改当前章**） */
  const mergeAsNextChapter = useCallback(
    async (currentChapterId: number): Promise<boolean> => {
      setError(null);
      try {
        const current = await repositories.chapter.get(currentChapterId);
        const siblings = await repositories.chapter.listByVolume(current.volumeId);
        const orderIndex = siblings.reduce((max, item) => Math.max(max, item.orderIndex), -1) + 1;
        await repositories.chapter.create({
          volumeId: current.volumeId,
          title: t("nextChapterTitle"),
          content: assembleDialogueHtml(entries),
          contentFormat: "html",
          orderIndex,
        });
        // 会话条目**保留**（不自动清空：用户可能继续合并或回看）
        return true;
      } catch {
        setError("merge-failed");
        return false;
      }
    },
    [entries, t],
  );

  /** 次路径（危险）：替换当前章（**先强制入池快照，必做**；单条撤销） */
  const replaceCurrentChapter = useCallback(
    (currentChapterId: number | null, currentHtml: string): boolean => {
      if (!editor || currentChapterId == null) {
        return false; // 未绑定编辑器 / 未选中章节：不执行
      }
      setError(null);
      try {
        // ① 强制安全网（必做，非可选）：替换前正文入版本池（会话内始终可恢复）
        useReviewStore.getState().addVersion({
          id: crypto.randomUUID(),
          label: "dialogue-merge-safety",
          content: currentHtml,
          round: -1,
          results: {},
        });
        // ② 单条撤销历史的整章替换
        const controller = createEditorController(editor);
        try {
          controller.replaceContent(assembleDialogueHtml(entries));
        } finally {
          controller.dispose(); // 用后即弃（REV-008）
        }
        return true;
      } catch {
        setError("merge-failed");
        return false;
      }
    },
    [editor, entries],
  );

  return { mergeAsNextChapter, replaceCurrentChapter, error };
}

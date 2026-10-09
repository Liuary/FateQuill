/**
 * 分支采纳与丢弃（stage-08 T4；REV-007 数据安全网）
 *
 * **双路径**：
 * - 主路径 `adoptAsNextChapter` —— **新建下一章草稿**（`chapter.create`，追加当前卷末）；
 *   **不改当前章 DB** → 无 DB 级丢失风险（自动保存不会覆盖原正文）。
 * - 次路径 `replaceCurrentChapter`（危险）—— `EditorController.replaceContent`（**单条撤销**）；
 *   执行前**强制把替换前正文入 stage-06 版本池快照（必做）**，使会话内始终可恢复。
 *
 * `discard`：从会话分支容器移除（无残留）。
 */

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { repositories } from "@/ipc/repositories";
import { createEditorController } from "@/features/editor/EditorController";
import { useExplorationStore } from "@/store/explorationStore";
import { useReviewStore } from "@/store/reviewStore";
import { renderTurnCardToHtml } from "./render-turn-card";

/** 确保分支被选中（`selectBranch` 为 toggle：已选中时不重复调用，避免落地后被取消选中） */
function ensureSelected(branchId: string): void {
  if (useExplorationStore.getState().selectedBranchId !== branchId) {
    useExplorationStore.getState().selectBranch(branchId);
  }
}

/** 分支采纳/丢弃编排 */
export function useAdoptBranch(editor: Editor | null) {
  const { t } = useTranslation("exploration");

  /** 主路径：新建下一章草稿（**不改当前章** → 无 DB 丢失风险） */
  const adoptAsNextChapter = useCallback(
    async (branchId: string, currentChapterId: number): Promise<boolean> => {
      const branch = useExplorationStore.getState().branches.find((item) => item.id === branchId);
      if (!branch?.card) {
        return false;
      }
      const current = await repositories.chapter.get(currentChapterId);
      const siblings = await repositories.chapter.listByVolume(current.volumeId);
      const orderIndex = siblings.reduce((max, item) => Math.max(max, item.orderIndex), -1) + 1;
      await repositories.chapter.create({
        volumeId: current.volumeId,
        title: t("nextChapterTitle"),
        content: renderTurnCardToHtml(branch.card),
        contentFormat: "html",
        orderIndex,
      });
      ensureSelected(branchId);
      return true;
    },
    [t],
  );

  /**
   * 次路径（危险）：替换当前章 —— **先强制入池快照（必做）**，再 `replaceContent`（单条撤销）。
   * `currentContentHtml` = 替换前正文（调用方取 `editor.getHTML()`）。
   */
  const replaceCurrentChapter = useCallback(
    (branchId: string, currentContentHtml: string): boolean => {
      const branch = useExplorationStore.getState().branches.find((item) => item.id === branchId);
      if (!editor || !branch?.card) {
        return false;
      }
      // 强制安全网（**必做，非可选**）：替换前正文入版本池（会话内始终可恢复）
      useReviewStore.getState().addVersion({
        id: crypto.randomUUID(),
        label: "adopt-safety",
        content: currentContentHtml,
        round: -1,
        results: {},
      });
      const controller = createEditorController(editor);
      try {
        controller.replaceContent(renderTurnCardToHtml(branch.card)); // 单条撤销历史
      } finally {
        controller.dispose(); // 用后即弃（REV-008）
      }
      ensureSelected(branchId);
      return true;
    },
    [editor],
  );

  /** 丢弃分支（会话容器移除，无残留） */
  const discard = useCallback((branchId: string) => {
    useExplorationStore.getState().removeBranch(branchId);
  }, []);

  return { adoptAsNextChapter, replaceCurrentChapter, discard };
}

/**
 * 台词评审桥接（stage-10 T7，**可选**）
 *
 * 把对话条目对齐到 stage-06 评审管线的 `ReviewInput` 契约（**不新增评估器、不改 stage-06 契约**）：
 * - `assembleDialogueText`：条目 → **纯文本**（去 HTML 标签；`dialogue` 为 `说话人：内容`，`narration` 为正文）；
 * - `toDialogueReviewInput`：构造 `ReviewInput`（`content` = 纯文本）。
 *
 * **可选性**：台词评审为**可选**能力（不强制；合并后章节走既有四维评审即可）。
 */

import {
  REVIEW_DIMENSIONS,
  type ReviewDimension,
  type ReviewInput,
} from "@/orchestration/review/types";
import type { DialogueEntry } from "./types";

/** 台词评审可用的维度（**复用 stage-06 `REVIEW_DIMENSIONS`** 单一来源） */
export const DIALOGUE_REVIEW_DIMENSIONS: ReviewDimension[] = REVIEW_DIMENSIONS;

/** 台词评审为**可选**能力（不强制启用） */
export const DIALOGUE_REVIEW_OPTIONAL = true;

/** 去除 HTML 标签（评审用纯文本；近似口径与 stage-02 `word_count` 的 html 分支一致） */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** 条目 → 纯文本（按 `orderIndex` 升序；供评审） */
export function assembleDialogueText(entries: DialogueEntry[]): string {
  return [...entries]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((entry) =>
      entry.kind === "dialogue"
        ? `${entry.speakerName ?? ""}：${stripHtml(entry.content)}`
        : stripHtml(entry.content),
    )
    .join("\n");
}

/** 构造台词评审输入（**对齐 stage-06 `ReviewInput`**；`content` = 纯文本） */
export function toDialogueReviewInput(input: {
  entries: DialogueEntry[];
  dimension: ReviewDimension;
  model: string;
  context?: ReviewInput["context"];
  temperature?: number;
}): ReviewInput {
  const reviewInput: ReviewInput = {
    dimension: input.dimension,
    content: assembleDialogueText(input.entries),
    model: input.model,
    temperature: input.temperature ?? 0,
  };
  if (input.context) {
    reviewInput.context = input.context;
  }
  return reviewInput;
}

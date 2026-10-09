/**
 * 评审输入预算裁剪（stage-06 BUG-001 修复）
 *
 * 职责：把送入 LLM 的**章节正文**按预算裁剪，避免长章正文全量进入每维评审与每轮重写调用
 * （每章 4 次评审 + 最多 2 次重写）造成 Token 成本线性放大（plan v2 L71 / DoD 第 7 条 REV-006）。
 *
 * 预算口径：**沿用装配预算**（复用 stage-05 `PROMPT_BUDGET.total`），保持单一来源。
 * 裁剪序：保留正文**开头**（判据主段），超出部分截断并追加裁剪标记（可观测 / 可判定）。
 */

import { PROMPT_BUDGET } from "@/orchestration/prompts/chapter-generation";

/** 评审正文预算（字符数；沿用 stage-05 装配预算 `PROMPT_BUDGET.total`） */
export const REVIEW_CONTENT_BUDGET: number = PROMPT_BUDGET.total;

/** 正文被裁剪时追加的标记（供可观测性与测试判定；不计入预算） */
export const REVIEW_TRIM_MARKER = "\n\n…（正文超出评审预算，已裁剪）";

/**
 * 按预算裁剪评审正文：
 * - `content.length <= budget` → 原样返回；
 * - 超限 → 保留开头 `budget` 个字符 + 裁剪标记。
 */
export function trimReviewContent(content: string, budget: number = REVIEW_CONTENT_BUDGET): string {
  if (content.length <= budget) {
    return content;
  }
  return content.slice(0, budget) + REVIEW_TRIM_MARKER;
}

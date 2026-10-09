/**
 * 走向卡 → HTML 草稿（stage-08 T4）
 *
 * 职责：把走向卡渲染为可写入章节正文的 HTML（摘要 + 关键转折列表 + 引用设定卡说明）。
 */

import type { TurnCard } from "@/orchestration/exploration/types";

/** 转义 HTML 特殊字符（避免走向卡文本破坏结构） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 走向卡 → HTML 草稿（summary + keyTurns + 引用设定卡 id 说明） */
export function renderTurnCardToHtml(card: TurnCard): string {
  const blocks: string[] = [`<h2>${escapeHtml(card.summary)}</h2>`];
  if (card.keyTurns.length > 0) {
    const turns = card.keyTurns.map((turn) => `<li>${escapeHtml(turn)}</li>`).join("");
    blocks.push(`<ul>${turns}</ul>`);
  }
  if (card.settingCardIds.length > 0) {
    blocks.push(`<p>引用设定卡：${card.settingCardIds.join(", ")}</p>`);
  }
  return blocks.join("");
}

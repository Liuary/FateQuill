/**
 * 多声部合并器（stage-10 T3）
 *
 * 条目 → HTML：**按 `orderIndex` 升序**拼接；格式**单一规范**（样式由 CSS 承担）：
 * - 对话：`<p class="dialogue"><strong>{speakerName}</strong>：{content}</p>`
 * - 旁白：`<p class="narration">{content}</p>`
 *
 * 文本一律 **HTML 转义**（`& < > " '`）防注入；空条目 → 空串。
 */

import type { DialogueEntry } from "./types";

/** HTML 转义（防注入） */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 条目 → HTML（按 `orderIndex` 升序；乱序输入亦正确归位） */
export function assembleDialogueHtml(entries: DialogueEntry[]): string {
  return [...entries]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((entry) =>
      entry.kind === "dialogue"
        ? `<p class="dialogue"><strong>${esc(entry.speakerName ?? "")}</strong>：${esc(entry.content)}</p>`
        : `<p class="narration">${esc(entry.content)}</p>`,
    )
    .join("");
}

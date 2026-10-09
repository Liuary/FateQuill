/** 生成约 chars 个非空白字符的 HTML（段落切分），用于性能载荷 */
export function makeHtml(chars: number, paragraphs = 20): string {
  const per = Math.ceil(chars / paragraphs);
  return Array.from({ length: paragraphs }, () => `<p>${"字".repeat(per)}</p>`).join("");
}

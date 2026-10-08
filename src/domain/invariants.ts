import { ChapterStatus, ContentFormat } from "./values";

// 6 个校验函数覆盖 T1 五条不变量清单：清单④「枚举值域」拆为 ④content_format + ⑤status；⑥ 为清单⑤「删除后统计一致」。

/** ① 同一父级内 order_index 唯一且连续（从 0 起） */
export function isContiguousUniqueOrder(indices: number[]): boolean {
  if (indices.length === 0) return true;
  const sorted = [...indices].sort((a, b) => a - b);
  return sorted.every((v, i) => v === i) && new Set(indices).size === indices.length;
}
/** ② 外键有效：子项父 id 存在于父集合 */
export function hasValidForeignKey(parentIds: Set<number>, childParentId: number): boolean {
  return parentIds.has(childParentId);
}
/** ③ content 非空约束（NOT NULL 语义：不得为 null/undefined） */
export function isContentPresent(content: unknown): content is string {
  return typeof content === "string";
}
/** ④ content_format 属枚举值域 */
export function isValidContentFormat(value: unknown): value is ContentFormat {
  return (Object.values(ContentFormat) as unknown[]).includes(value);
}
/** ⑤ status 属枚举值域 */
export function isValidChapterStatus(value: unknown): value is ChapterStatus {
  return (Object.values(ChapterStatus) as unknown[]).includes(value);
}
/** ⑥ 删除后统计一致：word_count 合计 = 各章 wordCount 之和；章数 = 各卷章数之和 */
export function areStatsConsistent(
  expected: { totalWords: number; chapterCount: number },
  actual: { totalWords: number; chapterCount: number },
): boolean {
  return expected.totalWords === actual.totalWords && expected.chapterCount === actual.chapterCount;
}

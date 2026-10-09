/**
 * 引文 verbatim 搜索定位（stage-07 T3）
 *
 * 职责：在正文中按**引文原文精确搜索**定位；唯一命中即定位，**多命中取首个并标记歧义**；
 * 并截取**前后文各 ≤`ctx` 字**（默认 50）作为 `position` 上下文（REV-016①：`excerpt` 为唯一权威）。
 */

export interface LocateResult {
  /** 首个命中索引；未命中为 -1 */
  index: number;
  /** 命中次数 */
  matches: number;
  /** 是否多命中（需提示用户） */
  ambiguous: boolean;
  contextBefore: string;
  contextAfter: string;
}

const EMPTY: LocateResult = {
  index: -1,
  matches: 0,
  ambiguous: false,
  contextBefore: "",
  contextAfter: "",
};

/** 统计出现次数（不重叠） */
function countOccurrences(content: string, needle: string): number {
  let matches = 0;
  let from = content.indexOf(needle);
  while (from !== -1) {
    matches += 1;
    from = content.indexOf(needle, from + needle.length);
  }
  return matches;
}

/** 在正文中定位引文：取首个命中；多命中标记 `ambiguous`；返回前后文各 ≤`ctx` 字 */
export function locateExcerpt(content: string, excerpt: string, ctx = 50): LocateResult {
  if (!content || !excerpt) {
    return { ...EMPTY };
  }
  const index = content.indexOf(excerpt);
  if (index < 0) {
    return { ...EMPTY }; // 未命中
  }
  const matches = countOccurrences(content, excerpt);
  return {
    index,
    matches,
    ambiguous: matches > 1,
    contextBefore: content.slice(Math.max(0, index - ctx), index),
    contextAfter: content.slice(index + excerpt.length, index + excerpt.length + ctx),
  };
}

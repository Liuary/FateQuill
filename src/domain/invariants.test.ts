import { describe, expect, it } from "vitest";
import { ChapterStatus, ContentFormat } from "@/domain/values";
import {
  areStatsConsistent,
  hasValidForeignKey,
  isContentPresent,
  isContiguousUniqueOrder,
  isValidChapterStatus,
  isValidContentFormat,
} from "@/domain/invariants";

describe("domain invariants", () => {
  it("① order_index 连续唯一", () => {
    expect(isContiguousUniqueOrder([0, 1, 2])).toBe(true);
    expect(isContiguousUniqueOrder([0, 2])).toBe(false);
    expect(isContiguousUniqueOrder([0, 1, 1])).toBe(false);
  });
  it("② 外键有效", () => {
    expect(hasValidForeignKey(new Set([1, 2]), 2)).toBe(true);
    expect(hasValidForeignKey(new Set([1, 2]), 9)).toBe(false);
  });
  it("③ content 非空约束", () => {
    expect(isContentPresent("")).toBe(true);
    expect(isContentPresent(null)).toBe(false);
    expect(isContentPresent(undefined)).toBe(false);
  });
  it("④/⑤ 枚举值域", () => {
    expect(isValidContentFormat(ContentFormat.Html)).toBe(true);
    expect(isValidContentFormat("md")).toBe(false);
    expect(isValidChapterStatus(ChapterStatus.Archived)).toBe(true);
    expect(isValidChapterStatus("published")).toBe(false);
  });
  it("⑥ 删除后统计一致", () => {
    expect(
      areStatsConsistent(
        { totalWords: 100, chapterCount: 2 },
        { totalWords: 100, chapterCount: 2 },
      ),
    ).toBe(true);
    expect(
      areStatsConsistent({ totalWords: 100, chapterCount: 2 }, { totalWords: 90, chapterCount: 2 }),
    ).toBe(false);
  });
});

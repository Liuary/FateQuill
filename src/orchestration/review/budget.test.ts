import { describe, expect, it } from "vitest";
import { REVIEW_CONTENT_BUDGET, REVIEW_TRIM_MARKER, trimReviewContent } from "./budget";

describe("trimReviewContent（评审预算裁剪，BUG-001）", () => {
  it("未超预算：原样返回且无裁剪标记", () => {
    const short = "第一章正文";
    expect(trimReviewContent(short)).toBe(short);
    expect(trimReviewContent(short)).not.toContain(REVIEW_TRIM_MARKER);
  });

  it("边界：等于预算时原样返回", () => {
    const exact = "字".repeat(REVIEW_CONTENT_BUDGET);
    expect(trimReviewContent(exact)).toBe(exact);
  });

  it("超预算：裁剪至预算内并追加裁剪标记", () => {
    const long = "字".repeat(REVIEW_CONTENT_BUDGET * 3);
    const out = trimReviewContent(long);
    expect(out).toContain(REVIEW_TRIM_MARKER);
    expect(out.startsWith("字".repeat(10))).toBe(true);
    expect(out.length).toBe(REVIEW_CONTENT_BUDGET + REVIEW_TRIM_MARKER.length);
    expect(out.length).toBeLessThan(long.length);
  });

  it("可注入自定义预算", () => {
    expect(trimReviewContent("abcdef", 3)).toBe("abc" + REVIEW_TRIM_MARKER);
  });

  it("沿用装配预算口径（stage-05 `PROMPT_BUDGET.total`）", () => {
    expect(REVIEW_CONTENT_BUDGET).toBe(8000);
  });
});

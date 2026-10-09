import { describe, expect, it } from "vitest";
import { RESEARCH_TAGS, RESEARCH_TAGS_VERSION, isValidTag } from "./tags";

describe("受控标签枚举（stage-07 T3）", () => {
  it("版本常量存在（语义化）", () => {
    expect(RESEARCH_TAGS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("初始枚举含四类（套话/排比/空洞形容/翻译腔）", () => {
    expect([...RESEARCH_TAGS]).toEqual(["cliche", "parallelism", "empty", "translationese"]);
  });

  it("isValidTag：合法标签通过", () => {
    for (const tag of RESEARCH_TAGS) {
      expect(isValidTag(tag)).toBe(true);
    }
  });

  it("isValidTag：非法标签拒绝（含大小写敏感）", () => {
    expect(isValidTag("bogus")).toBe(false);
    expect(isValidTag("")).toBe(false);
    expect(isValidTag("Cliche")).toBe(false);
  });
});

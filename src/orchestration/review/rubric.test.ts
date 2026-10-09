import { describe, expect, it } from "vitest";
import { REVIEW_DIMENSIONS } from "./types";
import { REVIEW_RUBRIC_VERSION, RUBRIC_BANDS, RUBRICS, buildReviewSystemPrompt } from "./rubric";
import rubricDoc from "../../../docs/review-rubric.md?raw";

describe("rubric", () => {
  it("版本常量存在且与文档一致", () => {
    expect(REVIEW_RUBRIC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(rubricDoc).toContain(`REVIEW_RUBRIC_VERSION = "${REVIEW_RUBRIC_VERSION}"`);
  });

  it("四维子维度齐备", () => {
    for (const dimension of REVIEW_DIMENSIONS) {
      expect(RUBRICS[dimension].dimension).toBe(dimension);
      expect(RUBRICS[dimension].subDimensions.length).toBeGreaterThan(0);
    }
  });

  it("四档分档", () => {
    expect(RUBRIC_BANDS.map((b) => b.label)).toEqual(["不合格", "合格", "良", "优"]);
  });

  it("system prompt 内联 rubric + 强制 JSON 指令", () => {
    const prompt = buildReviewSystemPrompt("plot");
    expect(prompt).toContain(REVIEW_RUBRIC_VERSION);
    expect(prompt).toContain("逻辑连贯");
    expect(prompt).toContain('"score"');
    expect(prompt).toContain("0–100");
  });
});

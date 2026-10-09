import { describe, expect, it } from "vitest";
import { makeHtml } from "./seed";

describe("makeHtml", () => {
  it("生成约 5000 个非空白字符", () => {
    const html = makeHtml(5000);
    const text = html.replace(/<[^>]*>/g, "");
    expect(text.replace(/\s/g, "").length).toBe(5000);
  });

  it("段落数可配置", () => {
    expect((makeHtml(100, 4).match(/<p>/g) ?? []).length).toBe(4);
  });
});

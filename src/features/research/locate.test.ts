import { describe, expect, it } from "vitest";
import { locateExcerpt } from "./locate";

const content = "开场若干字凑足长度。她不禁皱了皱眉，望向窗外。收尾同样若干字凑长度。";

describe("locateExcerpt（verbatim 搜索定位）", () => {
  it("唯一命中：index 正确、无歧义", () => {
    const result = locateExcerpt(content, "她不禁皱了皱眉");
    expect(result.index).toBe(content.indexOf("她不禁皱了皱眉"));
    expect(result.matches).toBe(1);
    expect(result.ambiguous).toBe(false);
  });

  it("多命中：取首个并标记 ambiguous", () => {
    const result = locateExcerpt("甲甲甲甲甲甲甲甲", "甲");
    expect(result.index).toBe(0);
    expect(result.matches).toBe(8);
    expect(result.ambiguous).toBe(true);
  });

  it("未命中：index=-1 且上下文为空", () => {
    expect(locateExcerpt(content, "不存在的句子")).toEqual({
      index: -1,
      matches: 0,
      ambiguous: false,
      contextBefore: "",
      contextAfter: "",
    });
  });

  it("前后文各 ≤50 字（默认 ctx=50）", () => {
    const long = "前".repeat(80) + "引文" + "后".repeat(80);
    const result = locateExcerpt(long, "引文");
    expect(result.contextBefore).toHaveLength(50);
    expect(result.contextAfter).toHaveLength(50);
  });

  it("可注入更小的 ctx", () => {
    const long = "前".repeat(80) + "引文" + "后".repeat(80);
    const result = locateExcerpt(long, "引文", 10);
    expect(result.contextBefore).toHaveLength(10);
    expect(result.contextAfter).toHaveLength(10);
  });

  it("空引文 / 空正文 → 未命中", () => {
    expect(locateExcerpt("", "x").index).toBe(-1);
    expect(locateExcerpt("x", "").index).toBe(-1);
  });
});

import { describe, expect, it } from "vitest";
import { HEXAGRAMS } from "./hexagrams";
import { TRIGRAMS } from "./trigrams";
import { binaryToNames, validateIChing } from "./validate";
import type { Hexagram } from "./types";

describe("六十四卦数据（stage-09 T1）", () => {
  it("六条规则全部通过（64 / 384 / 名唯一 / 8×8 / King Wen 1~64 / 二进制自洽）", () => {
    const result = validateIChing(HEXAGRAMS, TRIGRAMS);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("卦数 = 64；爻辞合计 = 384（每卦 6 爻）", () => {
    expect(HEXAGRAMS).toHaveLength(64);
    expect(HEXAGRAMS.every((hexagram) => hexagram.lines.length === 6)).toBe(true);
    expect(HEXAGRAMS.reduce((sum, hexagram) => sum + hexagram.lines.length, 0)).toBe(384);
  });

  it("King Wen 卦序为 1~64 连续无缺", () => {
    expect(HEXAGRAMS.map((hexagram) => hexagram.kingWen)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    );
  });

  it("卦名唯一", () => {
    const names = HEXAGRAMS.map((hexagram) => hexagram.name);
    expect(new Set(names).size).toBe(64);
  });

  it("上下卦组合覆盖 8×8", () => {
    const combos = new Set(HEXAGRAMS.map((hexagram) => `${hexagram.upper}|${hexagram.lower}`));
    expect(combos.size).toBe(64);
  });

  it("八卦（TRIGRAMS）为 8 个且 binary 均 3 位", () => {
    expect(TRIGRAMS).toHaveLength(8);
    expect(TRIGRAMS.every((trigram) => /^[01]{3}$/.test(trigram.binary))).toBe(true);
  });

  it("抽样卦字段完整：乾 / 坤 / 既济", () => {
    const qian = HEXAGRAMS[0];
    expect(qian.name).toBe("乾");
    expect(qian.binary).toBe("111111");
    expect(qian.upper).toBe("乾");
    expect(qian.lower).toBe("乾");
    expect(qian.judgment.length).toBeGreaterThan(0);
    expect(qian.lines).toHaveLength(6);
    expect(qian.lines[0]).toContain("潜龙勿用");

    const kun = HEXAGRAMS[1];
    expect(kun.name).toBe("坤");
    expect(kun.binary).toBe("000000");
    expect(kun.lines[0]).toContain("履霜");

    const jiji = HEXAGRAMS.find((hexagram) => hexagram.name === "既济")!;
    expect(jiji.kingWen).toBe(63);
    expect(jiji.binary).toBe("101010"); // 坎(010) 上 / 离(101) 下
    expect(jiji.upper).toBe("坎");
    expect(jiji.lower).toBe("离");
    expect(jiji.judgment.length).toBeGreaterThan(0);
    expect(jiji.lines).toHaveLength(6);
  });

  it("binaryToNames：自下而上（前 3 位下卦 / 后 3 位上卦）", () => {
    expect(binaryToNames("101010", TRIGRAMS)).toEqual({ upper: "坎", lower: "离" });
    expect(binaryToNames("111111", TRIGRAMS)).toEqual({ upper: "乾", lower: "乾" });
    expect(binaryToNames("000100", TRIGRAMS)).toEqual({ upper: "震", lower: "坤" });
  });

  it("负向：重复卦名 → ok=false 且 errors 非空", () => {
    const tampered: Hexagram[] = HEXAGRAMS.map((hexagram, index) =>
      index === 1 ? { ...hexagram, name: "乾" } : hexagram,
    );
    const result = validateIChing(tampered, TRIGRAMS);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("卦名重复"))).toBe(true);
  });

  it("负向：缺一爻 → ok=false（384 与单卦 6 爻两条规则）", () => {
    const tampered: Hexagram[] = HEXAGRAMS.map((hexagram, index) =>
      index === 0 ? { ...hexagram, lines: hexagram.lines.slice(0, 5) } : hexagram,
    );
    const result = validateIChing(tampered, TRIGRAMS);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("384"))).toBe(true);
    expect(result.errors.some((error) => error.includes("爻数应为 6"))).toBe(true);
  });

  it("负向：binary 与上下卦不符 / 非法 binary → 映射自洽规则报错", () => {
    const mismatched: Hexagram[] = HEXAGRAMS.map((hexagram, index) =>
      index === 0 ? { ...hexagram, binary: "000000" } : hexagram,
    );
    const bad = validateIChing(mismatched, TRIGRAMS);
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((error) => error.includes("映射不一致"))).toBe(true);

    const illegal: Hexagram[] = HEXAGRAMS.map((hexagram, index) =>
      index === 0 ? { ...hexagram, binary: "12x" } : hexagram,
    );
    const invalid = validateIChing(illegal, TRIGRAMS);
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.some((error) => error.includes("6 位 0/1"))).toBe(true);
  });

  it("负向：卦序缺一 → King Wen 1~64 连续规则报错", () => {
    const tampered: Hexagram[] = HEXAGRAMS.map((hexagram, index) =>
      index === 63 ? { ...hexagram, kingWen: 1 } : hexagram,
    );
    const result = validateIChing(tampered, TRIGRAMS);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("King Wen"))).toBe(true);
  });
});

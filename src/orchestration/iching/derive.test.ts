import { describe, expect, it } from "vitest";
import { HEXAGRAMS } from "@/data/iching/hexagrams";
import { deriveHexagram, readingVerses, zhuXiReading } from "./derive";
import { castManual } from "./random";

const cast = (binary: string, changing: number[] = []) =>
  deriveHexagram(castManual(binary, changing));

describe("deriveHexagram（本卦/之卦/变爻）", () => {
  it("六爻皆静：本卦 = 之卦、无变爻（乾）", () => {
    const casting = cast("111111");
    expect(casting.benGua.name).toBe("乾");
    expect(casting.zhiGua.name).toBe("乾");
    expect(casting.changingLines).toEqual([]);
    expect(casting.reading).toEqual({ changingCount: 0, source: "ben", lineIndices: [] });
  });

  it("一爻变：之卦 = 变爻取反（乾初爻变 → 姤 011111）", () => {
    const casting = cast("111111", [0]);
    expect(casting.benGua.name).toBe("乾");
    expect(casting.zhiGua.name).toBe("姤");
    expect(casting.zhiGua.binary).toBe("011111");
    expect(casting.changingLines).toEqual([0]);
    expect(casting.reading).toEqual({ changingCount: 1, source: "ben", lineIndices: [0] });
  });

  it("二爻变：以上爻为主（primaryIndex = 较大的变爻下标）", () => {
    const casting = cast("111111", [0, 2]);
    expect(casting.reading).toEqual({
      changingCount: 2,
      source: "ben",
      lineIndices: [0, 2],
      primaryIndex: 2,
    });
  });

  it("三爻变：本卦与之卦卦辞（source=both）", () => {
    const casting = cast("111111", [0, 1, 2]);
    expect(casting.reading).toEqual({ changingCount: 3, source: "both", lineIndices: [] });
  });

  it("四爻变：之卦两不变爻，以下爻为主（primaryIndex = 较小者）", () => {
    const casting = cast("111111", [0, 1, 2, 3]); // 不变爻 = [4, 5]
    expect(casting.reading).toEqual({
      changingCount: 4,
      source: "zhi",
      lineIndices: [4, 5],
      primaryIndex: 4,
    });
  });

  it("五爻变：之卦不变爻（唯一）", () => {
    const casting = cast("111111", [0, 1, 2, 3, 4]); // 不变爻 = [5]
    expect(casting.reading).toEqual({ changingCount: 5, source: "zhi", lineIndices: [5] });
  });

  it("六爻变：之卦卦辞（乾 → 坤）", () => {
    const casting = cast("111111", [0, 1, 2, 3, 4, 5]);
    expect(casting.zhiGua.name).toBe("坤");
    expect(casting.reading).toEqual({ changingCount: 6, source: "zhi", lineIndices: [] });
  });

  it("爻数不为 6 → 抛错", () => {
    expect(() => deriveHexagram([])).toThrow(/6 lines/);
    expect(() => deriveHexagram(castManual("111111").slice(0, 5))).toThrow(/6 lines/);
  });
});

describe("zhuXiReading 一致性守卫", () => {
  it("变爻集合与两卦差异不一致 → 抛错", () => {
    const qian = HEXAGRAMS[0];
    const kun = HEXAGRAMS[1];
    expect(() => zhuXiReading([], qian, kun)).toThrow(/delta/);
  });
});

describe("readingVerses（应读经文原文，不译）", () => {
  it("0 爻变 → 本卦卦辞", () => {
    const casting = cast("111111");
    expect(readingVerses(casting)).toEqual([casting.benGua.judgment]);
  });

  it("1 爻变 → 本卦该爻爻辞", () => {
    const casting = cast("111111", [0]);
    expect(readingVerses(casting)).toEqual([casting.benGua.lines[0]]);
  });

  it("3 爻变 → 本卦 + 之卦卦辞", () => {
    const casting = cast("111111", [0, 1, 2]);
    expect(readingVerses(casting)).toEqual([casting.benGua.judgment, casting.zhiGua.judgment]);
  });

  it("4 爻变 → 之卦两不变爻爻辞", () => {
    const casting = cast("111111", [0, 1, 2, 3]);
    expect(readingVerses(casting)).toEqual([casting.zhiGua.lines[4], casting.zhiGua.lines[5]]);
  });

  it("6 爻变 → 之卦卦辞", () => {
    const casting = cast("111111", [0, 1, 2, 3, 4, 5]);
    expect(readingVerses(casting)).toEqual([casting.zhiGua.judgment]);
  });
});

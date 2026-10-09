import { describe, expect, it } from "vitest";
import { deriveHexagram } from "./derive";
import { buildGuideCard, renderGuideText } from "./guide";
import { castManual } from "./random";
import type { Casting } from "./types";

const cast = (binary: string, changing: number[] = []): Casting =>
  deriveHexagram(castManual(binary, changing));

describe("buildGuideCard（卦象引导卡）", () => {
  it("五字段齐全（乾，六爻皆静）", () => {
    const casting = cast("111111");
    const card = buildGuideCard(casting);

    expect(Object.keys(card).sort()).toEqual([
      "changingLineReadings",
      "fateHints",
      "hexagramName",
      "judgmentDigest",
      "plotHints",
    ]);
    expect(card.hexagramName).toBe("乾");
    expect(card.judgmentDigest.length).toBeGreaterThan(0);
    expect(card.judgmentDigest).toContain("元亨利贞"); // 白文原样
    expect(card.changingLineReadings).toEqual([casting.benGua.judgment]); // 0 爻变 → 本卦卦辞
    expect(card.plotHints.length).toBeGreaterThan(0);
    expect(card.fateHints.length).toBeGreaterThan(0);
    expect(card.plotHints.join("")).toContain("乾");
    expect(card.fateHints.join("")).toContain("乾");
  });

  it("依朱熹情形取文本：1 爻变 → 本卦变爻爻辞（坤）", () => {
    const casting = cast("000000", [0]);
    const card = buildGuideCard(casting);
    expect(card.hexagramName).toBe("坤");
    expect(card.changingLineReadings).toHaveLength(1);
    expect(card.changingLineReadings[0]).toContain("履霜"); // 坤初六
  });

  it("依朱熹情形取文本：6 爻变 → 之卦卦辞（既济 → 未济）", () => {
    const casting = cast("101010", [0, 1, 2, 3, 4, 5]);
    expect(casting.benGua.name).toBe("既济");
    const card = buildGuideCard(casting);
    expect(card.hexagramName).toBe("既济");
    expect(card.changingLineReadings).toEqual([casting.zhiGua.judgment]);
    expect(casting.zhiGua.name).toBe("未济");
    expect(card.changingLineReadings[0]).toContain("小狐汔济");
  });

  it("依朱熹情形取文本：3 爻变 → 本卦 + 之卦卦辞", () => {
    const casting = cast("111111", [0, 1, 2]);
    const card = buildGuideCard(casting);
    expect(card.changingLineReadings).toHaveLength(2);
    expect(card.plotHints.join("")).toContain("三爻变");
  });

  it("确定性：同卦象两次调用深相等", () => {
    const casting = cast("111111", [0, 2]);
    expect(buildGuideCard(casting)).toEqual(buildGuideCard(casting));
    // 相同输入重建 casting（同卦象）→ 同卡
    expect(buildGuideCard(cast("111111", [0, 2]))).toEqual(buildGuideCard(casting));
  });

  it("卦辞超长 → 摘要截断并加省略号", () => {
    const casting = cast("010000"); // 师：贞，丈人吉，无咎。（短）
    const long = buildGuideCard({
      ...casting,
      benGua: { ...casting.benGua, judgment: "甲".repeat(60) },
    });
    expect(long.judgmentDigest).toHaveLength(41); // 40 + 省略号
    expect(long.judgmentDigest.endsWith("…")).toBe(true);
  });
});

describe("renderGuideText（system 段文本）", () => {
  it("含卦名、卦辞、经文与提示", () => {
    const card = buildGuideCard(cast("111111", [0]));
    const text = renderGuideText(card);

    expect(text).toContain("易经卦象引导：");
    expect(text).toContain("- 本卦：乾");
    expect(text).toContain("- 卦辞：");
    expect(text).toContain("- 应变经文：");
    expect(text).toContain("- 剧情提示：");
    expect(text).toContain("- 宿命提示：");
    expect(text).toContain("潜龙勿用"); // 经文原样（不译）
  });

  it("确定性：同卡两次渲染一致", () => {
    const card = buildGuideCard(cast("101010", [0, 1, 2]));
    expect(renderGuideText(card)).toBe(renderGuideText(card));
  });
});

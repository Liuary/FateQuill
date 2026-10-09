import { describe, expect, it } from "vitest";
import { deriveHexagram } from "./derive";
import { buildFateCard } from "./fate";
import { castManual } from "./random";

const cast = (binary: string, changing: number[] = []) =>
  deriveHexagram(castManual(binary, changing));

describe("buildFateCard（一次性宿命提示卡）", () => {
  it("确定性：同卦象同目标 → 深相等", () => {
    const casting = cast("111111", [0]);
    expect(buildFateCard(casting, "林砚")).toEqual(buildFateCard(casting, "林砚"));
    expect(buildFateCard(cast("111111", [0]), "林砚")).toEqual(buildFateCard(casting, "林砚"));
  });

  it("title 含本卦名；content 含目标名与宿命提示（非空）", () => {
    const casting = cast("101010", [0, 1, 2]); // 既济，三爻变
    const card = buildFateCard(casting, "阿禾");

    expect(card.title).toBe("宿命·既济");
    expect(card.title).toContain(casting.benGua.name);
    expect(card.content.length).toBeGreaterThan(0);
    expect(card.content).toContain("对象：阿禾");
    expect(card.content).toContain("本卦：既济");
    expect(card.content).toContain("宿命基调"); // 来自引导卡 fateHints
  });

  it("不同目标 → content 不同（绑定目标名）", () => {
    const casting = cast("000000");
    expect(buildFateCard(casting, "甲").content).not.toBe(buildFateCard(casting, "乙").content);
  });

  it("爻变数不同 → 宿命基调不同（七情形模板）", () => {
    const none = buildFateCard(cast("111111"), "甲");
    const one = buildFateCard(cast("111111", [0]), "甲");
    expect(none.content).not.toBe(one.content);
    expect(none.content).toContain("六爻皆静");
    expect(one.content).toContain("一爻动");
  });
});

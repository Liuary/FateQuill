import { describe, expect, it } from "vitest";
import { DEFAULT_SETTING_CARD_TIER, isSettingCardTier, SETTING_CARD_TIERS } from "./setting-card";

describe("设定卡分级常量（与 kind 正交）", () => {
  it("四级定稿：main / dark / short / temp", () => {
    expect(SETTING_CARD_TIERS).toEqual(["main", "dark", "short", "temp"]);
  });

  it("缺省分级为 short（与迁移 v5 的 DEFAULT 一致）", () => {
    expect(DEFAULT_SETTING_CARD_TIER).toBe("short");
  });

  it("isSettingCardTier 值域判定（未知值 / 非字符串 → false）", () => {
    for (const tier of SETTING_CARD_TIERS) {
      expect(isSettingCardTier(tier)).toBe(true);
    }
    expect(isSettingCardTier("bogus")).toBe(false);
    expect(isSettingCardTier("")).toBe(false);
    expect(isSettingCardTier(undefined)).toBe(false);
    expect(isSettingCardTier(1)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { INJECTABLE_TIERS, isInjectableTier, selectInjectableCards } from "./inject";

const cards = [
  { id: 1, title: "主线规则", tier: "main" },
  { id: 2, title: "近期设定", tier: "short" },
  { id: 3, title: "幕后身份", tier: "dark" },
  { id: 4, title: "一次性细节", tier: "temp" },
];

describe("inject（分级注入白名单；暗线硬隔离）", () => {
  it("白名单常量 = `{main, short}`（不含 dark / temp）", () => {
    expect(INJECTABLE_TIERS).toEqual(["main", "short"]);
  });

  it("isInjectableTier：main/short → true；**dark/temp → false**", () => {
    expect(isInjectableTier("main")).toBe(true);
    expect(isInjectableTier("short")).toBe(true);
    expect(isInjectableTier("dark")).toBe(false);
    expect(isInjectableTier("temp")).toBe(false);
  });

  it("未标注（null / 空串）→ true（沿用默认 `short` 的既有注入）；未知值 → false（fail-closed）", () => {
    expect(isInjectableTier(null)).toBe(true);
    expect(isInjectableTier(undefined)).toBe(true);
    expect(isInjectableTier("")).toBe(true);
    expect(isInjectableTier("bogus")).toBe(false);
    expect(isInjectableTier(1)).toBe(false);
  });

  it("selectInjectableCards：四类卡混合 → 仅 main/short 通过（**恒排除 dark**）", () => {
    expect(selectInjectableCards(cards).map((card) => card.id)).toEqual([1, 2]);
    // 安全不变量：结果中不存在 dark
    expect(selectInjectableCards(cards).some((card) => card.tier === "dark")).toBe(false);
  });

  it("未标注分级的历史卡仍可注入（兼容迁移 v5 默认 short 之前的夹具）", () => {
    const legacy = [{ id: 9, title: "旧卡", tier: undefined }];
    expect(selectInjectableCards(legacy).map((card) => card.id)).toEqual([9]);
  });

  it("纯函数：不改原数组、不改元素形态", () => {
    const input = cards.map((card) => ({ ...card }));
    const before = JSON.stringify(input);
    const out = selectInjectableCards(input);
    expect(JSON.stringify(input)).toBe(before); // 原数组未被改动
    expect(out[0]).toEqual(cards[0]); // 元素形态保持
  });
});

import { describe, expect, it } from "vitest";
import { deriveHexagram } from "./derive";
import { castManual, castRandom, createSeededRng } from "./random";

describe("createSeededRng（种子复现）", () => {
  it("同种子 → 同序列", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("不同种子 → 不同序列", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(43);
    expect(Array.from({ length: 5 }, () => a())).not.toEqual(Array.from({ length: 5 }, () => b()));
  });
});

describe("castRandom（三枚铜钱法）", () => {
  it("产出 6 爻（自下而上）", () => {
    const lines = castRandom();
    expect(lines).toHaveLength(6);
    expect(lines.every((line) => typeof line.yang === "boolean")).toBe(true);
  });

  it("种子复现：同种子 → 同卦（可判定）", () => {
    const first = deriveHexagram(castRandom(createSeededRng(42)));
    const second = deriveHexagram(castRandom(createSeededRng(42)));
    expect(second.benGua.name).toBe(first.benGua.name);
    expect(second.zhiGua.name).toBe(first.zhiGua.name);
    expect(second.changingLines).toEqual(first.changingLines);
  });

  it("随机源可注入：固定随机源 → 可预期结果", () => {
    // rng 恒返回 0 → 每枚铜钱取 2 → 每爻 6（老阴，皆变）
    const lines = castRandom(() => 0);
    expect(lines.every((line) => !line.yang && line.changes)).toBe(true);
    const casting = deriveHexagram(lines);
    expect(casting.benGua.name).toBe("坤");
    expect(casting.zhiGua.name).toBe("乾"); // 六爻皆变 → 坤之乾
    expect(casting.changingLines).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("castManual（手动起卦）", () => {
  it("指定卦 + 变爻", () => {
    const lines = castManual("111111", [0]);
    expect(lines).toHaveLength(6);
    expect(lines.every((line) => line.yang)).toBe(true);
    expect(lines[0].changes).toBe(true);
    expect(lines.slice(1).every((line) => !line.changes)).toBe(true);

    const casting = deriveHexagram(lines);
    expect(casting.benGua.name).toBe("乾");
    expect(casting.zhiGua.name).toBe("姤");
    expect(casting.changingLines).toEqual([0]);
  });

  it("默认无变爻", () => {
    expect(castManual("101010").every((line) => !line.changes)).toBe(true);
  });

  it("非法 binary → 抛错", () => {
    expect(() => castManual("12x")).toThrow(/invalid binary/);
    expect(() => castManual("11111")).toThrow(/invalid binary/);
  });
});

import { describe, expect, it } from "vitest";
import { LIUREN_GENERALS } from "./generals";
import { LIUREN_LESSON_SLOTS, LIUREN_PATTERNS, LIUREN_TRANSMISSION_SLOTS } from "./lessons";
import { LIUREN_PALACES } from "./palaces";
import { EARTHLY_BRANCHES, HEAVENLY_STEMS, JIAZI_60, STEM_HOME_PALACE } from "./ganzhi";
import { validateLiuren } from "./validate";
import { LIUREN_DATA, LIUREN_DATA_VERSION } from "./index";
import type { LiurenData } from "./types";

/** 合法基线数据（逐项 copy，避免改坏静态常量） */
const base = (): LiurenData => ({
  generals: LIUREN_GENERALS.map((general) => ({ ...general })),
  palaces: LIUREN_PALACES.map((palace) => ({ ...palace })),
  lessonSlots: LIUREN_LESSON_SLOTS.map((slot) => ({ ...slot })),
  transmissionSlots: LIUREN_TRANSMISSION_SLOTS.map((slot) => ({ ...slot })),
  patterns: LIUREN_PATTERNS.map((pattern) => ({ ...pattern })),
});

describe("大六壬静态数据（stage-12 T1）", () => {
  it("正向：12 天将 / 12 宫 / 四课三传 / 九宗门 / 六十甲子 / 十干寄宫 全部通过", () => {
    const result = validateLiuren(LIUREN_DATA);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(LIUREN_DATA_VERSION).toBe("1.0.0");
  });

  it("规模断言：12 / 12 / 4 / 3 / 9 / 60 / 10", () => {
    expect(LIUREN_GENERALS).toHaveLength(12);
    expect(LIUREN_PALACES).toHaveLength(12);
    expect(LIUREN_LESSON_SLOTS).toHaveLength(4);
    expect(LIUREN_TRANSMISSION_SLOTS).toHaveLength(3);
    expect(LIUREN_PATTERNS).toHaveLength(9);
    expect(JIAZI_60).toHaveLength(60);
    expect(HEAVENLY_STEMS).toHaveLength(10);
    expect(EARTHLY_BRANCHES).toHaveLength(12);
  });

  it("宫位：十二支齐全唯一，月将名唯一，序号 0..11 连续", () => {
    expect(LIUREN_PALACES.map((palace) => palace.branch)).toEqual([...EARTHLY_BRANCHES]);
    expect(new Set(LIUREN_PALACES.map((palace) => palace.generalName)).size).toBe(12);
    expect(LIUREN_PALACES.map((palace) => palace.order)).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    );
  });

  it("天将：序号 1..12 连续且六吉六凶", () => {
    expect(LIUREN_GENERALS.map((general) => general.order)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(LIUREN_GENERALS.filter((general) => general.nature === "吉")).toHaveLength(6);
    expect(LIUREN_GENERALS.filter((general) => general.nature === "凶")).toHaveLength(6);
  });

  it("六十甲子：唯一、阳配阳阴配阴、含甲子与癸亥", () => {
    expect(new Set(JIAZI_60).size).toBe(60);
    expect(JIAZI_60[0]).toBe("甲子");
    expect(JIAZI_60[59]).toBe("癸亥");
  });

  it("负向：缺一天将 → 拒绝且指出数量", () => {
    const data = base();
    data.generals = data.generals.slice(0, 11);
    const result = validateLiuren(data);
    expect(result.ok).toBe(false);
    expect(result.errors.join("；")).toContain("天将应为 12");
  });

  it("负向：天将名重复 / 序号不连续 → 拒绝", () => {
    const data = base();
    data.generals[1] = { ...data.generals[1], name: data.generals[0].name };
    expect(validateLiuren(data).errors.join("；")).toContain("天将名称重复");

    const data2 = base();
    data2.generals[0] = { ...data2.generals[0], order: 99 };
    expect(validateLiuren(data2).errors.join("；")).toContain("天将序号应为 1..12 连续");
  });

  it("负向：宫位缺支 / 五行非法 / 月将名重复 → 拒绝", () => {
    const missing = base();
    missing.palaces.pop();
    expect(validateLiuren(missing).errors.join("；")).toContain("宫应为 12");

    const badElement = base();
    badElement.palaces[0] = { ...badElement.palaces[0], element: "风" as never };
    expect(validateLiuren(badElement).errors.join("；")).toContain("宫位五行非法");

    const dupName = base();
    dupName.palaces[1] = { ...dupName.palaces[1], generalName: dupName.palaces[0].generalName };
    expect(validateLiuren(dupName).errors.join("；")).toContain("月将名重复");
  });

  it("负向：四课课位不足 / 三传位不足 / 课体不足或缺伏吟返吟 → 拒绝", () => {
    const shortLessons = base();
    shortLessons.lessonSlots = shortLessons.lessonSlots.slice(0, 3);
    expect(validateLiuren(shortLessons).errors.join("；")).toContain("四课课位应为 4");

    const shortTransmissions = base();
    shortTransmissions.transmissionSlots = shortTransmissions.transmissionSlots.slice(0, 2);
    expect(validateLiuren(shortTransmissions).errors.join("；")).toContain("三传位应为 3");

    const shortPatterns = base();
    shortPatterns.patterns = shortPatterns.patterns.filter((pattern) => pattern.name !== "伏吟课");
    const errors = validateLiuren(shortPatterns).errors.join("；");
    expect(errors).toContain("课体应为 9");
    expect(errors).toContain("课体缺 伏吟课");
  });

  it("负向：十干寄宫缺失 → 拒绝（结构完整性）", () => {
    const original = STEM_HOME_PALACE["甲"];
    delete STEM_HOME_PALACE["甲"];
    try {
      expect(validateLiuren(base()).errors.join("；")).toContain("天干 甲 缺寄宫");
    } finally {
      STEM_HOME_PALACE["甲"] = original;
    }
  });
});

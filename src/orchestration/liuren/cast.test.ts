import { describe, expect, it } from "vitest";
import { EARTHLY_BRANCHES, branchIndex } from "@/data/liuren/ganzhi";
import { castLiuren } from "./cast";

/** 取某支的天盘上神（与 `cast.ts` 同口径，供断言独立复算） */
function upperOf(chart: { heaven: string[] }, branch: string): string {
  return chart.heaven[branchIndex(branch)];
}

describe("castLiuren（手动月将 + 时辰 + 日干支；不引历法库）", () => {
  it("天盘 = 月将加时（顺布）：月将安于时辰宫，余支顺行", () => {
    const result = castLiuren({ monthGeneral: "亥", hourBranch: "子", dayGanzhi: "甲子" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.chart.heaven[branchIndex("子")]).toBe("亥"); // 月将加时
    expect(result.chart.heaven[branchIndex("丑")]).toBe("子"); // 顺行一位
    expect(result.chart.heaven[branchIndex("亥")]).toBe("戌");
    expect(result.chart.earth).toEqual([...EARTHLY_BRANCHES]); // 地盘固定
  });

  it("四课：一课取日干寄宫支上神；二 / 四课取前一课上神之上神；三课取日支上神", () => {
    const result = castLiuren({ monthGeneral: "亥", hourBranch: "子", dayGanzhi: "甲子" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { chart } = result;

    // 甲寄寅 → 一课下神 = 寅（本项目口径，见 docs/liuren-data.md）
    expect(chart.lessons.map((lesson) => lesson.lower)).toEqual([
      "寅",
      upperOf(chart, "寅"),
      "子",
      upperOf(chart, "子"),
    ]);
    expect(chart.lessons.map((lesson) => lesson.upper)).toEqual([
      upperOf(chart, "寅"),
      upperOf(chart, upperOf(chart, "寅")),
      upperOf(chart, "子"),
      upperOf(chart, upperOf(chart, "子")),
    ]);
    expect(chart.lessons.map((lesson) => lesson.label)).toEqual(["一课", "二课", "三课", "四课"]);
  });

  it("三传：初传 = 发用；中 / 末传依次为前传之上神（三传齐备）", () => {
    const result = castLiuren({ monthGeneral: "亥", hourBranch: "子", dayGanzhi: "甲子" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { chart } = result;

    expect(chart.transmissions.map((transmission) => transmission.label)).toEqual([
      "初传",
      "中传",
      "末传",
    ]);
    const [first, middle, last] = chart.transmissions.map((transmission) => transmission.branch);
    expect(middle).toBe(upperOf(chart, first));
    expect(last).toBe(upperOf(chart, middle));
    expect(chart.pattern.name.length).toBeGreaterThan(0);
  });

  it("伏吟 / 返吟：月将 = 时辰 → 伏吟课；月将与时支相冲 → 返吟课", () => {
    const fu = castLiuren({ monthGeneral: "亥", hourBranch: "亥", dayGanzhi: "甲子" });
    expect(fu.ok && fu.chart.pattern.name).toBe("伏吟课");
    // 伏吟时天地盘不动
    expect(fu.ok && fu.chart.heaven).toEqual([...EARTHLY_BRANCHES]);

    const fan = castLiuren({ monthGeneral: "亥", hourBranch: "巳", dayGanzhi: "甲子" });
    expect(fan.ok && fan.chart.pattern.name).toBe("返吟课");
  });

  it("天将：昼贵 / 夜贵分别起宫（甲日昼贵丑、夜贵未），并按落宫顺 / 逆布十二将", () => {
    const day = castLiuren({ monthGeneral: "寅", hourBranch: "卯", dayGanzhi: "甲子" });
    expect(day.ok && day.chart.daytime).toBe(true); // 卯..申 为昼
    // 昼贵丑（落丑 → 巳至戌之外即亥至辰 → 顺布）
    expect(day.ok && day.chart.heavenGenerals[branchIndex("丑")]).toBe("贵人");

    const night = castLiuren({ monthGeneral: "寅", hourBranch: "酉", dayGanzhi: "甲子" });
    expect(night.ok && night.chart.daytime).toBe(false); // 酉..寅 为夜
    expect(night.ok && night.chart.heavenGenerals[branchIndex("未")]).toBe("贵人"); // 夜贵未
  });

  it("非法输入：早返回错误（不抛穿），且错误信息指出字段", () => {
    const badMonth = castLiuren({ monthGeneral: "甲", hourBranch: "子", dayGanzhi: "甲子" });
    expect(badMonth.ok).toBe(false);
    expect(!badMonth.ok && badMonth.error).toContain("月将非法");

    const badHour = castLiuren({ monthGeneral: "亥", hourBranch: "卯卯", dayGanzhi: "甲子" });
    expect(badHour.ok).toBe(false);
    expect(!badHour.ok && badHour.error).toContain("时辰非法");

    const badGanzhi = castLiuren({ monthGeneral: "亥", hourBranch: "子", dayGanzhi: "甲丑" });
    expect(badGanzhi.ok).toBe(false);
    expect(!badGanzhi.ok && badGanzhi.error).toContain("日干支非法");
  });

  it("REV-006 定稿：`dayGanzhi` **必填**（四课以日干支为据）；六十甲子均可起课", () => {
    for (const ganzhi of ["甲子", "乙丑", "癸亥"]) {
      const result = castLiuren({ monthGeneral: "亥", hourBranch: "子", dayGanzhi: ganzhi });
      expect(result.ok).toBe(true);
      expect(result.ok && result.chart.dayGanzhi).toBe(ganzhi);
      expect(result.ok && result.chart.lessons).toHaveLength(4);
    }
  });
});

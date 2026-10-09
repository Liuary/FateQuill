import { describe, expect, it } from "vitest";
import { parseTurnCard } from "./parse";

describe("parseTurnCard（走向卡解析）", () => {
  it("合法走向卡", () => {
    const card = parseTurnCard(
      '{"summary":"主角北上","keyTurns":["遇袭","结盟"],"settingCardIds":[1,2]}',
    );
    expect(card).toEqual({
      summary: "主角北上",
      keyTurns: ["遇袭", "结盟"],
      settingCardIds: [1, 2],
    });
  });

  it("围栏 / 前后文字容错", () => {
    const fenced =
      '以下是走向卡：\n```json\n{"summary":"南渡","keyTurns":[],"settingCardIds":[]}\n```\n以上。';
    expect(parseTurnCard(fenced).summary).toBe("南渡");
  });

  it("settingCardIds 去非数（字符串 / null / NaN）", () => {
    const card = parseTurnCard('{"summary":"x","keyTurns":[],"settingCardIds":[1,"2",null,3]}');
    expect(card.settingCardIds).toEqual([1, 3]);
  });

  it("缺省字段归一：keyTurns 缺失 → 空数组；非串元素归一为字符串", () => {
    expect(parseTurnCard('{"summary":"x"}')).toEqual({
      summary: "x",
      keyTurns: [],
      settingCardIds: [],
    });
    expect(parseTurnCard('{"summary":"x","keyTurns":[1,"二"]}').keyTurns).toEqual(["1", "二"]);
  });

  it("非法 → 抛错", () => {
    expect(() => parseTurnCard("not json")).toThrow();
    expect(() => parseTurnCard('{"keyTurns":[]}')).toThrow(/summary/);
    expect(() => parseTurnCard("[1,2]")).toThrow();
    expect(() => parseTurnCard('{"summary":"   "}')).toThrow(/summary/);
  });
});

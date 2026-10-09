import { describe, expect, it } from "vitest";
import { castLiuren } from "./cast";
import { buildLiurenCard, renderLiurenText } from "./guide";

const chart = (() => {
  const result = castLiuren({ monthGeneral: "亥", hourBranch: "子", dayGanzhi: "甲子" });
  if (!result.ok) throw new Error("fixture cast failed");
  return result.chart;
})();

describe("liuren guide（课体引导卡与注入文本）", () => {
  it("buildLiurenCard：标题/副题含课体与三要素；四课三传逐条可读", () => {
    const card = buildLiurenCard(chart);
    expect(card.title).toContain(chart.pattern.name);
    expect(card.subtitle).toContain(chart.dayGanzhi);
    expect(card.subtitle).toContain(chart.monthGeneralName);
    expect(card.subtitle).toContain(chart.hourBranch);
    expect(card.lessons).toHaveLength(4);
    expect(card.transmissions).toHaveLength(3);
    expect(card.lessons[0]).toContain("一课");
    expect(card.transmissions[0]).toContain("初传");
    expect(card.heavenSummary).toContain("上见");
    expect(card.generalsSummary).toContain("乘");
    expect(card.pattern).toContain(chart.pattern.rule.length > 0 ? chart.pattern.name : "");
    expect(card.lines.length).toBeGreaterThanOrEqual(5);
  });

  it("renderLiurenText：非空、含课体/四课/三传，且带「不得违背用户设定约束」声明", () => {
    const text = renderLiurenText(chart);
    expect(text).toContain("【大六壬课体引导】");
    expect(text).toContain("课体：");
    expect(text).toContain("四课：");
    expect(text).toContain("三传：");
    expect(text).toContain(chart.pattern.name);
    expect(text).toContain("不得违背用户设定约束");
  });

  it("相同输入 → 文本稳定（纯函数，可复现）", () => {
    const again = castLiuren({ monthGeneral: "亥", hourBranch: "子", dayGanzhi: "甲子" });
    expect(again.ok && renderLiurenText(again.chart)).toBe(renderLiurenText(chart));
  });
});

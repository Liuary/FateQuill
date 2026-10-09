import { describe, expect, it } from "vitest";
import { renderTurnCardToHtml } from "./render-turn-card";

describe("renderTurnCardToHtml（走向卡 → HTML 草稿）", () => {
  it("含 summary 与各 keyTurns", () => {
    const html = renderTurnCardToHtml({
      summary: "主角北上结盟",
      keyTurns: ["渡口遇袭", "与旧敌结盟"],
      settingCardIds: [1, 2],
    });

    expect(html).toContain("<h2>主角北上结盟</h2>");
    expect(html).toContain("<li>渡口遇袭</li>");
    expect(html).toContain("<li>与旧敌结盟</li>");
    expect(html).toContain("<p>引用设定卡：1, 2</p>");
  });

  it("无 keyTurns / 无设定卡引用 → 省略对应块", () => {
    const html = renderTurnCardToHtml({ summary: "只留摘要", keyTurns: [], settingCardIds: [] });
    expect(html).toBe("<h2>只留摘要</h2>");
  });

  it("转义 HTML 特殊字符", () => {
    const html = renderTurnCardToHtml({
      summary: "<script>alert(1)</script>",
      keyTurns: ['a & b "c"'],
      settingCardIds: [],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &quot;c&quot;");
  });
});

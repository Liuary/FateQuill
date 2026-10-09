import { describe, expect, it } from "vitest";
import { assembleDialogueHtml, esc } from "./assemble";
import type { DialogueEntry } from "./types";

const entry = (over: Partial<DialogueEntry>): DialogueEntry => ({
  id: "e",
  kind: "narration",
  content: "",
  orderIndex: 0,
  ...over,
});

describe("esc（HTML 转义防注入）", () => {
  it("转义 & < > \" '", () => {
    expect(esc(`<script>alert("x")</script>&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;",
    );
  });
});

describe("assembleDialogueHtml（按 orderIndex 拼接）", () => {
  it("乱序输入 → 按 orderIndex 升序归位拼接", () => {
    const html = assembleDialogueHtml([
      entry({ id: "c", kind: "narration", content: "三", orderIndex: 2 }),
      entry({ id: "a", kind: "narration", content: "一", orderIndex: 0 }),
      entry({ id: "b", kind: "dialogue", speakerName: "林砚", content: "二", orderIndex: 1 }),
    ]);

    expect(html).toBe(
      '<p class="narration">一</p>' +
        '<p class="dialogue"><strong>林砚</strong>：二</p>' +
        '<p class="narration">三</p>',
    );
  });

  it("格式统一：dialogue 带 strong 说话人；narration 仅正文", () => {
    expect(
      assembleDialogueHtml([entry({ kind: "dialogue", speakerName: "阿禾", content: "走吧。" })]),
    ).toBe('<p class="dialogue"><strong>阿禾</strong>：走吧。</p>');
    expect(assembleDialogueHtml([entry({ kind: "narration", content: "雾散。" })])).toBe(
      '<p class="narration">雾散。</p>',
    );
  });

  it("内容 / 说话人转义（防注入）", () => {
    const html = assembleDialogueHtml([
      entry({
        kind: "dialogue",
        speakerName: "<b>甲</b>",
        content: '<img src=x onerror="hack()">',
      }),
    ]);
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;b&gt;甲&lt;/b&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;hack()&quot;&gt;");
  });

  it("空数组 → 空串", () => {
    expect(assembleDialogueHtml([])).toBe("");
  });
});

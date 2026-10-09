import { describe, expect, it } from "vitest";
import type { ChatOptions, ModelProvider } from "@/orchestration/types";
import { buildRewriteMessages, rewriteChapter, type FailedDimensionFeedback } from "./rewrite";
import { REVIEW_CONTENT_BUDGET, REVIEW_TRIM_MARKER } from "./budget";

const feedback: FailedDimensionFeedback[] = [
  { dimension: "plot", score: 52, reasons: ["冲突推进乏力", "伏笔未呼应"] },
  { dimension: "humanity", score: 48, reasons: ["套话密度偏高"] },
];

describe("buildRewriteMessages（反馈注入）", () => {
  it("结构化注入未通过维度的 score + reasons", () => {
    const messages = buildRewriteMessages({ content: "<p>原正文</p>", feedback });
    expect(messages).toHaveLength(2);

    const user = messages[1].content;
    expect(user).toContain("<p>原正文</p>"); // 原文注入
    expect(user).toContain("score=52"); // 上一轮分数
    expect(user).toContain("冲突推进乏力"); // reasons
    expect(user).toContain("score=48");
    expect(user).toContain("套话密度偏高");
    expect(user).toContain("[plot]");
    expect(user).toContain("[humanity]");
    // 结构化：每条反馈独占一行
    expect(user.split("\n").filter((line) => line.startsWith("- [")).length).toBe(2);
  });

  it("instruction 注入本轮要求", () => {
    const messages = buildRewriteMessages({ content: "x", feedback, instruction: "压缩节奏" });
    expect(messages[1].content).toContain("压缩节奏");
  });

  it("system 要求保留原意且仅输出正文", () => {
    const messages = buildRewriteMessages({ content: "x", feedback });
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("保留原意");
    expect(messages[0].content).toContain("只输出改写后的正文");
  });

  it("长正文：重写 prompt 中的待改正文被裁剪至预算内（BUG-001）", () => {
    const long = "字".repeat(REVIEW_CONTENT_BUDGET * 4);
    const messages = buildRewriteMessages({ content: long, feedback });
    const user = messages[1].content;
    expect(user).toContain(REVIEW_TRIM_MARKER); // 裁剪标记
    expect(user).not.toContain("字".repeat(REVIEW_CONTENT_BUDGET + 1)); // 不含超预算原文
    expect(user.length).toBeLessThan(long.length);
  });
});

describe("rewriteChapter（非流式收口）", () => {
  it("聚合 provider 全文并去首尾空白", async () => {
    const calls: ChatOptions[] = [];
    const provider: ModelProvider & { calls: ChatOptions[] } = {
      id: "fake",
      calls,
      async *stream(options: ChatOptions) {
        calls.push(options);
        yield { delta: "  <p>改写一</p>" };
        yield { delta: "<p>改写二</p>  " };
      },
    };
    const out = await rewriteChapter({ provider, model: "m", rewrite: { content: "x", feedback } });
    expect(out).toBe("<p>改写一</p><p>改写二</p>");
    expect(calls).toHaveLength(1);
    expect(calls[0].temperature).toBe(0);
    expect(calls[0].messages[1].content).toContain("score=52"); // 反馈随请求发出
  });
});

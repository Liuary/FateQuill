import { describe, expect, it } from "vitest";
import type { ChatOptions, ModelProvider } from "@/orchestration/types";
import { evaluateWithFallback } from "../evaluator";
import type { ReviewInput } from "../types";
import { createLlmJudgeEvaluator } from "./llm-judge";
import plotValid from "../../../../tests/fixtures/review/plot.valid.json?raw";

const input: ReviewInput = { dimension: "plot", content: "正文", model: "m" };

/** 假 provider：把回放文本切成 `chunks` 块逐块 yield */
function fakeProvider(text: string, chunks: number) {
  const calls: ChatOptions[] = [];
  const provider: ModelProvider & { calls: ChatOptions[] } = {
    id: "fake",
    calls,
    async *stream(options: ChatOptions) {
      calls.push(options);
      const size = Math.max(1, Math.ceil(text.length / chunks));
      for (let i = 0; i < text.length; i += size) {
        yield { delta: text.slice(i, i + size) };
      }
    },
  };
  return provider;
}

describe("createLlmJudgeEvaluator（非流式收口）", () => {
  it("多块增量聚合后解析（聚合完整文本再 parse）", async () => {
    const provider = fakeProvider(plotValid, 20);
    const evaluator = createLlmJudgeEvaluator({ dimension: "plot", provider });
    const result = await evaluateWithFallback(evaluator, input);
    expect(result.score).toBe(86);
    expect(provider.calls).toHaveLength(1);
  });

  it("id 取 dimension", () => {
    const provider = fakeProvider(plotValid, 1);
    expect(createLlmJudgeEvaluator({ dimension: "humanity", provider }).id).toBe("humanity");
  });

  it("空响应 → 解析失败 → 降级（不抛穿）", async () => {
    const provider = fakeProvider("", 1);
    const evaluator = createLlmJudgeEvaluator({ dimension: "plot", provider });
    await expect(evaluateWithFallback(evaluator, input)).resolves.toMatchObject({ score: 60 });
  });
});

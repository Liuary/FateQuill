import { describe, expect, it } from "vitest";
import type { ChatOptions, ModelProvider } from "@/orchestration/types";
import { DEGRADED_SCORE, evaluateWithFallback } from "../evaluator";
import { REVIEW_RUBRIC_VERSION } from "../rubric";
import type { ReviewInput } from "../types";
import { createPlotEvaluator } from "./plot";
import plotValid from "../../../../tests/fixtures/review/plot.valid.json?raw";
import plotFenced from "../../../../tests/fixtures/review/plot.fenced.txt?raw";
import malformed from "../../../../tests/fixtures/review/malformed.txt?raw";
import plotSample from "../../../../tests/fixtures/review-samples/plot.sample.txt?raw";
import expectedRaw from "../../../../tests/fixtures/review-samples/expected.json?raw";

const expected = JSON.parse(expectedRaw) as Record<string, { min: number; max: number }>;

/** 假 provider：回放给定文本（分块 yield），并记录收到的 ChatOptions */
function fakeProvider(text: string, chunks = 3) {
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

const input: ReviewInput = {
  dimension: "plot",
  content: plotSample,
  model: "test-model",
  temperature: 0,
};

describe("剧情评估器（LLM-as-judge 夹具回放）", () => {
  it("合法夹具回放：得分落在期望区间", async () => {
    const provider = fakeProvider(plotValid);
    const result = await evaluateWithFallback(createPlotEvaluator(provider), input);
    expect(result.score).toBeGreaterThanOrEqual(expected.plot.min);
    expect(result.score).toBeLessThanOrEqual(expected.plot.max);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("围栏样本可解析", async () => {
    const provider = fakeProvider(plotFenced);
    const result = await evaluateWithFallback(createPlotEvaluator(provider), input);
    expect(result.score).toBe(83);
  });

  it("调用契约：temperature=0、system 含 rubric 版本、user 为待审正文", async () => {
    const provider = fakeProvider(plotValid);
    const evaluator = createPlotEvaluator(provider);
    await evaluateWithFallback(evaluator, input);
    expect(evaluator.id).toBe("plot");
    expect(provider.calls).toHaveLength(1);
    const options = provider.calls[0];
    expect(options.temperature).toBe(0);
    expect(options.model).toBe("test-model");
    expect(options.messages[0].content).toContain(REVIEW_RUBRIC_VERSION);
    expect(options.messages[1].content).toBe(plotSample);
  });

  it("malformed 回放 → 降级默认分（不抛穿）", async () => {
    const provider = fakeProvider(malformed);
    const result = await evaluateWithFallback(createPlotEvaluator(provider), input);
    expect(result.score).toBe(DEGRADED_SCORE);
    expect(result.reasons.join("")).toContain("判定失败");
  });
});

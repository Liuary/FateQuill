import { describe, expect, it } from "vitest";
import type { ChatOptions, ModelProvider } from "@/orchestration/types";
import { evaluateWithFallback } from "../evaluator";
import type { ReviewInput } from "../types";
import { createWorldviewEvaluator } from "./worldview";
import worldviewValid from "../../../../tests/fixtures/review/worldview.valid.json?raw";
import worldviewSample from "../../../../tests/fixtures/review-samples/worldview.sample.txt?raw";
import expectedRaw from "../../../../tests/fixtures/review-samples/expected.json?raw";

const expected = JSON.parse(expectedRaw) as Record<string, { min: number; max: number }>;

function fakeProvider(text: string) {
  const calls: ChatOptions[] = [];
  const provider: ModelProvider & { calls: ChatOptions[] } = {
    id: "fake",
    calls,
    async *stream(options: ChatOptions) {
      calls.push(options);
      for (const ch of text.split("")) {
        yield { delta: ch };
      }
    },
  };
  return provider;
}

const input: ReviewInput = {
  dimension: "worldview",
  content: worldviewSample,
  model: "test-model",
};

describe("世界观评估器（LLM-as-judge 夹具回放）", () => {
  it("合法夹具回放：得分落在期望区间", async () => {
    const provider = fakeProvider(worldviewValid);
    const evaluator = createWorldviewEvaluator(provider);
    const result = await evaluateWithFallback(evaluator, input);
    expect(evaluator.id).toBe("worldview");
    expect(result.score).toBeGreaterThanOrEqual(expected.worldview.min);
    expect(result.score).toBeLessThanOrEqual(expected.worldview.max);
    // 未显式给 temperature → 默认 0
    expect(provider.calls[0].temperature).toBe(0);
  });
});

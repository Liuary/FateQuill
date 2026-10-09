import { describe, expect, it } from "vitest";
import type { ChatOptions, ModelProvider } from "@/orchestration/types";
import { evaluateWithFallback } from "../evaluator";
import type { ReviewInput } from "../types";
import { createHumanityEvaluator } from "./humanity";
import humanityValid from "../../../../tests/fixtures/review/humanity.valid.json?raw";
import humanitySample from "../../../../tests/fixtures/review-samples/humanity.sample.txt?raw";
import expectedRaw from "../../../../tests/fixtures/review-samples/expected.json?raw";

const expected = JSON.parse(expectedRaw) as Record<string, { min: number; max: number }>;

function fakeProvider(text: string) {
  const calls: ChatOptions[] = [];
  const provider: ModelProvider & { calls: ChatOptions[] } = {
    id: "fake",
    calls,
    async *stream(options: ChatOptions) {
      calls.push(options);
      yield { delta: text };
    },
  };
  return provider;
}

const input: ReviewInput = {
  dimension: "humanity",
  content: humanitySample,
  model: "test-model",
};

describe("真人感评估器（LLM-as-judge 夹具回放）", () => {
  it("合法夹具回放：得分落在期望区间", async () => {
    const provider = fakeProvider(humanityValid);
    const evaluator = createHumanityEvaluator(provider);
    const result = await evaluateWithFallback(evaluator, input);
    expect(evaluator.id).toBe("humanity");
    expect(result.score).toBeGreaterThanOrEqual(expected.humanity.min);
    expect(result.score).toBeLessThanOrEqual(expected.humanity.max);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

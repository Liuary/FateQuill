import { describe, expect, it } from "vitest";
import type { Evaluator, ReviewInput } from "../types";
import { createComplianceEvaluator } from "./compliance";
import positiveSample from "../../../../tests/fixtures/review-samples/compliance.positive.txt?raw";
import negativeSample from "../../../../tests/fixtures/review-samples/compliance.negative.txt?raw";

const inputOf = (content: string): ReviewInput => ({
  dimension: "compliance",
  content,
  model: "n/a",
});

const hitsOf = (findings: unknown): { ruleId: string; category: string }[] =>
  (findings as { hits: { ruleId: string; category: string }[] }).hits;

describe("合规规则评估器（无需 Token / Provider）", () => {
  it("正样本命中：score < 100 且 findings 含类目", async () => {
    const result = await createComplianceEvaluator().evaluate(inputOf(positiveSample));
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
    const hits = hitsOf(result.findings);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((h) => h.category)).toContain("ad");
    expect(result.reasons.join("")).toContain("广告");
  });

  it("负样本：score = 100 且无命中", async () => {
    const result = await createComplianceEvaluator().evaluate(inputOf(negativeSample));
    expect(result.score).toBe(100);
    expect(hitsOf(result.findings)).toHaveLength(0);
  });

  it("构造无需 provider（id = compliance）", () => {
    expect(createComplianceEvaluator().id).toBe("compliance");
  });

  it("同规则多次命中只扣一次", async () => {
    const result = await createComplianceEvaluator().evaluate(inputOf("加微信，加微信，加微信"));
    expect(result.score).toBe(85); // 仅 ad-002 计一次（权重 15）
    expect(hitsOf(result.findings)).toHaveLength(1);
  });

  it("自定义词表可配置", async () => {
    const evaluator = createComplianceEvaluator({
      rules: [{ id: "x-1", category: "ad", pattern: "广告词", note: "自定义" }],
    });
    const result = await evaluator.evaluate(inputOf("这里有广告词哦"));
    expect(result.score).toBe(85);
  });

  it("可选 LLM 复核：取更低分并附复核理由", async () => {
    const llmReview: Evaluator = {
      id: "compliance",
      evaluate: async () => ({ score: 20, reasons: ["疑似违规"] }),
    };
    const result = await createComplianceEvaluator({ llmReview }).evaluate(inputOf(negativeSample));
    expect(result.score).toBe(20);
    expect(result.reasons.join("")).toContain("[LLM复核]");
    expect((result.findings as { llmReview: unknown }).llmReview).not.toBeNull();
  });
});

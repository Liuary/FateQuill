import { describe, expect, it } from "vitest";
import { INPUT_TOKENS_PER_BRANCH_DEFAULT, OUTPUT_TOKEN_LIMIT_DEFAULT, estimateCost } from "./cost";

describe("estimateCost（成本预估）", () => {
  it("默认：分支数 ×（输出上限 + 输入估算）", () => {
    const estimate = estimateCost(3);
    const perBranch = OUTPUT_TOKEN_LIMIT_DEFAULT + INPUT_TOKENS_PER_BRANCH_DEFAULT;
    expect(estimate.tokens).toBe(3 * perBranch);
    expect(estimate.note).toContain(String(OUTPUT_TOKEN_LIMIT_DEFAULT));
    expect(estimate.note).toContain(String(INPUT_TOKENS_PER_BRANCH_DEFAULT));
  });

  it("含输入侧 N 倍（REV-008①）：输入估算按分支数累加", () => {
    expect(estimateCost(1).tokens).toBe(
      OUTPUT_TOKEN_LIMIT_DEFAULT + INPUT_TOKENS_PER_BRANCH_DEFAULT,
    );
    expect(estimateCost(4).tokens).toBe(
      4 * (OUTPUT_TOKEN_LIMIT_DEFAULT + INPUT_TOKENS_PER_BRANCH_DEFAULT),
    );
  });

  it("自定义输出上限 / 输入估算", () => {
    expect(estimateCost(2, { outputLimit: 100, inputTokensPerBranch: 50 }).tokens).toBe(300);
    expect(estimateCost(2, { outputLimit: 100, inputTokensPerBranch: 50 }).note).toContain("100");
  });

  it("边界：0 / 负数分支 → 0", () => {
    expect(estimateCost(0).tokens).toBe(0);
    expect(estimateCost(-3).tokens).toBe(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  DEGRADED_REASON,
  DEGRADED_SCORE,
  createEvaluatorRegistry,
  degradedResult,
  evaluateWithFallback,
} from "./evaluator";
import type { EvaluationResult, Evaluator, ReviewInput } from "./types";

const input: ReviewInput = { dimension: "plot", content: "正文", model: "m" };

const okEvaluator = (result: EvaluationResult): Evaluator => ({
  id: "plot",
  evaluate: async () => result,
});

const boomEvaluator = (): Evaluator => ({
  id: "plot",
  evaluate: async () => {
    throw new Error("bad json");
  },
});

describe("createEvaluatorRegistry", () => {
  it("复用 Registry：注册 / 解析 / 替换", () => {
    const reg = createEvaluatorRegistry();
    const a = okEvaluator({ score: 80, reasons: [] });
    reg.register(a);
    expect(reg.resolve("plot")).toBe(a);

    const b = okEvaluator({ score: 70, reasons: [] });
    reg.replace(b);
    expect(reg.resolve("plot")).toBe(b);
    expect(reg.has("plot")).toBe(true);
    expect(reg.list()).toHaveLength(1);
  });

  it("重复注册抛错（Registry 心智）", () => {
    const reg = createEvaluatorRegistry();
    reg.register(okEvaluator({ score: 1, reasons: [] }));
    expect(() => reg.register(okEvaluator({ score: 2, reasons: [] }))).toThrow(/duplicate/);
  });

  it("未注册解析抛错（Registry 心智）", () => {
    const reg = createEvaluatorRegistry();
    expect(() => reg.resolve("humanity")).toThrow(/not registered/);
  });
});

describe("evaluateWithFallback", () => {
  it("成功路径原样返回", async () => {
    const result: EvaluationResult = { score: 85, reasons: ["好"], findings: { x: 1 } };
    await expect(evaluateWithFallback(okEvaluator(result), input)).resolves.toBe(result);
  });

  it("抛错评估器 → 降级默认分 + 「判定失败」", async () => {
    const result = await evaluateWithFallback(boomEvaluator(), input);
    expect(result.score).toBe(DEGRADED_SCORE);
    expect(result.reasons).toContain(DEGRADED_REASON);
    expect(result.reasons.join("")).toContain("判定失败");
  });

  it("有限重试：attempts = retries + 1", async () => {
    const spy = vi.fn(async () => {
      throw new Error("x");
    });
    await evaluateWithFallback({ id: "plot", evaluate: spy }, input, { retries: 2 });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("重试后成功 → 返回成功结果", async () => {
    let n = 0;
    const flaky: Evaluator = {
      id: "plot",
      evaluate: async () => {
        n += 1;
        if (n === 1) throw new Error("x");
        return { score: 77, reasons: ["ok"] };
      },
    };
    await expect(evaluateWithFallback(flaky, input)).resolves.toEqual({
      score: 77,
      reasons: ["ok"],
    });
    expect(n).toBe(2);
  });

  it("不抛穿：抛错评估器 resolve 而非 reject", async () => {
    await expect(
      evaluateWithFallback(boomEvaluator(), input, { retries: 0 }),
    ).resolves.toBeTruthy();
  });

  it("degradedResult 用默认分", () => {
    expect(degradedResult("r")).toEqual({ score: DEGRADED_SCORE, reasons: ["r"] });
  });
});

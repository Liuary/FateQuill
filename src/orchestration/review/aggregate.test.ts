import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  weightedTotal,
  type EvaluationBundle,
  type ReviewWeights,
} from "./aggregate";

/** 构造仅含剧情 / 真人感两维的结果集 */
const bundle = (plot: number, humanity: number): EvaluationBundle => ({
  plot: { score: plot, reasons: [] },
  humanity: { score: humanity, reasons: [] },
});

describe("weightedTotal", () => {
  it("等权 → 已评审维度的算术平均", () => {
    expect(weightedTotal(bundle(80, 60), DEFAULT_WEIGHTS)).toBeCloseTo(70);
  });

  it("缺维不参与（仅按已评审维度归一）", () => {
    expect(weightedTotal({ plot: { score: 90, reasons: [] } }, DEFAULT_WEIGHTS)).toBeCloseTo(90);
  });

  it("权重可调且改变排序", () => {
    const v1 = bundle(90, 50);
    const v2 = bundle(60, 80);
    const plotHeavy: ReviewWeights = { plot: 3, worldview: 1, compliance: 1, humanity: 1 };
    const humanityHeavy: ReviewWeights = { plot: 1, worldview: 1, compliance: 1, humanity: 3 };

    // 等权：两版并列
    expect(weightedTotal(v1, DEFAULT_WEIGHTS)).toBeCloseTo(weightedTotal(v2, DEFAULT_WEIGHTS));
    // 剧情加重：v1 反超
    expect(weightedTotal(v1, plotHeavy)).toBeGreaterThan(weightedTotal(v2, plotHeavy));
    // 真人感加重：v2 反超
    expect(weightedTotal(v2, humanityHeavy)).toBeGreaterThan(weightedTotal(v1, humanityHeavy));
  });

  it("零权重维度不参与归一", () => {
    const weights: ReviewWeights = { ...DEFAULT_WEIGHTS, humanity: 0 };
    expect(weightedTotal(bundle(80, 10), weights)).toBeCloseTo(80);
  });

  it("无有效维度 → 0", () => {
    expect(weightedTotal({}, DEFAULT_WEIGHTS)).toBe(0);
    expect(
      weightedTotal(bundle(80, 60), { plot: 0, worldview: 0, compliance: 0, humanity: 0 }),
    ).toBe(0);
  });

  it("结果归一在 0–100", () => {
    expect(
      weightedTotal(
        { plot: { score: 100, reasons: [] }, humanity: { score: 100, reasons: [] } },
        DEFAULT_WEIGHTS,
      ),
    ).toBe(100);
    expect(weightedTotal({ plot: { score: 0, reasons: [] } }, DEFAULT_WEIGHTS)).toBe(0);
  });
});

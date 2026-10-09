/**
 * 加权评分（stage-06 T3）
 *
 * 职责：把一次审查的四维结果按**用户可调权重**归一为 0–100 总分。
 * **纯函数**（无副作用 / 无状态），供 `reviewStore` 与 UI 复用。
 */

import type { EvaluationResult, ReviewDimension } from "./types";

/** 一次审查的评估结果集合（维度 → 结果；**缺维表示该维度未参与**） */
export type EvaluationBundle = Partial<Record<ReviewDimension, EvaluationResult>>;

/** 四维权重（用户可调） */
export type ReviewWeights = Record<ReviewDimension, number>;

/** 默认权重（四维平衡） */
export const DEFAULT_WEIGHTS: ReviewWeights = { plot: 1, worldview: 1, compliance: 1, humanity: 1 };

/**
 * 加权总分：`Σ(score × weight) / Σweight`（仅计**已评审且权重 > 0** 的维度）。
 * - 缺维 / 权重 ≤ 0 / 非法权重：不参与归一；
 * - 无任何有效维度时返回 0；
 * - 结果夹取至 0–100。
 */
export function weightedTotal(results: EvaluationBundle, weights: ReviewWeights): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const dimension of Object.keys(results) as ReviewDimension[]) {
    const result = results[dimension];
    if (!result) {
      continue; // 缺维：不参与
    }
    const weight = weights[dimension];
    if (!Number.isFinite(weight) || weight <= 0) {
      continue; // 零 / 负 / 非法权重：不参与
    }
    weighted += result.score * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) {
    return 0; // 无有效维度
  }
  return Math.min(100, Math.max(0, weighted / totalWeight));
}

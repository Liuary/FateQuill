/**
 * 全自动**熔断三层**（stage-12 T3）
 *
 * **纯函数**（无 IO）：任一触发 → **即停并出报告**。
 * 1. **预算**：累计 token 达 `budgetLimit`（未配置则永不触发）；
 * 2. **连续失败**：连续未达阈章数达 `consecutiveFailureLimit`（默认 3）；
 * 3. **总章数**：已产出章数达 `maxChapters`（大纲更长时**此举即停**）。
 */

import type { AutopilotConfig } from "./types";

/** 熔断原因 */
export type BreakerReason = "budget" | "consecutive-failure" | "max-chapters";

/** 熔断判定输入（各层计数器） */
export interface BreakerInput {
  /** 累计花费（token；由 `estimateTokens` 逐章累加） */
  spentTokens: number;
  /** 连续未达阈章数（达阈即归零） */
  consecutiveFailures: number;
  /** 已产出章数 */
  producedChapters: number;
}

/** 熔断判定结果（`tripped` 为真时 `reason` 必有） */
export interface BreakerVerdict {
  tripped: boolean;
  reason?: BreakerReason;
  detail?: string;
}

/**
 * 粗粒度 token 估算（**用于预算熔断，无需精确**）：
 * 中文场景约「1 字 ≈ 1 token」，故以字符数估算；含极少量开销常数。
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length);
}

/** 熔断三层判定（**顺序**：预算 → 连续失败 → 章数；先命中者即原因） */
export function checkBreakers(input: BreakerInput, config: AutopilotConfig): BreakerVerdict {
  const { budgetLimit, consecutiveFailureLimit, maxChapters } = config;

  if (typeof budgetLimit === "number" && budgetLimit > 0 && input.spentTokens >= budgetLimit) {
    return {
      tripped: true,
      reason: "budget",
      detail: `累计 ${input.spentTokens} token ≥ 预算上限 ${budgetLimit}`,
    };
  }

  if (input.consecutiveFailures >= consecutiveFailureLimit) {
    return {
      tripped: true,
      reason: "consecutive-failure",
      detail: `连续 ${input.consecutiveFailures} 章未达阈 ≥ K=${consecutiveFailureLimit}`,
    };
  }

  if (input.producedChapters >= maxChapters) {
    return {
      tripped: true,
      reason: "max-chapters",
      detail: `已产出 ${input.producedChapters} 章 ≥ 章数上限 ${maxChapters}`,
    };
  }

  return { tripped: false };
}

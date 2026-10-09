/**
 * 评估器注册表与降级（stage-06 T1）
 *
 * 职责：以引擎泛型 `Registry<T>` 承载各维度评估器；提供带**有限重试**与**降级**的
 * `evaluateWithFallback`——评估/解析失败时重试，仍失败则返回默认分（`DEGRADED_SCORE`）
 * 并标注「判定失败」，**绝不抛穿**流水线。
 */

import { Registry } from "@/orchestration/registry";
import type { EvaluationResult, Evaluator, ReviewInput } from "./types";

/** 评估器注册表类型（复用引擎泛型 Registry） */
export type EvaluatorRegistry = Registry<Evaluator>;

/** 创建评估器注册表 */
export function createEvaluatorRegistry(): EvaluatorRegistry {
  return new Registry<Evaluator>();
}

/** 降级默认分（LLM 判定失败；不抛穿流水线，reasons 标注） */
export const DEGRADED_SCORE = 60;

/** 降级原因文案（reasons 中标注，供 UI/日志识别） */
export const DEGRADED_REASON = "判定失败：评分解析异常，已降级为默认分";

/** 构造降级结果：默认分 + 原因标注 */
export function degradedResult(reason: string): EvaluationResult {
  return { score: DEGRADED_SCORE, reasons: [reason] };
}

/**
 * 带有限重试与降级的评估。
 *
 * - `opts.retries`：额外重试次数（默认 1，即最多尝试 2 次）；
 * - 成功路径**原样返回**评估结果；
 * - 评估抛错（含 JSON 解析失败）→ 重试 → 仍失败返回降级结果（**不抛穿**）。
 */
export async function evaluateWithFallback(
  ev: Evaluator,
  input: ReviewInput,
  opts?: { retries?: number },
): Promise<EvaluationResult> {
  const retries = Math.max(0, Math.trunc(opts?.retries ?? 1));
  let attempt = 0;
  for (;;) {
    try {
      return await ev.evaluate(input);
    } catch {
      // 评估或解析失败：有限重试；达到上限则降级（不抛穿流水线）
      if (attempt >= retries) {
        return degradedResult(DEGRADED_REASON);
      }
      attempt += 1;
    }
  }
}

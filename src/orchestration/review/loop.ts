/**
 * 评审回路：判定 → 重写 → 复审（stage-06 T4）
 *
 * 职责：对初版正文四维评分；未通过且允许自动重写时，**注入上轮反馈**触发重写并复审，
 * **上限 2 次**（`maxRounds`），达上限转人工。重写产物经 `onVersion` **入池（不自动替换正文）**。
 *
 * **合规低分不作为自动重写触发项**（`triggerDims` 排除 `compliance`，仅人工裁决）。
 */

import type { ModelProvider } from "@/orchestration/types";
import { evaluateWithFallback, type EvaluatorRegistry } from "./evaluator";
import { weightedTotal, type EvaluationBundle, type ReviewWeights } from "./aggregate";
import { rewriteChapter, type FailedDimensionFeedback } from "./rewrite";
import { REVIEW_DIMENSIONS, type ReviewInput } from "./types";

/** 入池产物（结构化等价于 `ReviewVersion` 去掉 `totalScore`；此处保持 orchestration 不依赖 store） */
export interface ReviewArtifact {
  id: string;
  label: string;
  content: string;
  round: number;
  results: EvaluationBundle;
}

export interface ReviewLoopOptions {
  provider: ModelProvider;
  model: string;
  /** 初版正文 */
  content: string;
  evaluators: EvaluatorRegistry;
  weights: ReviewWeights;
  /** 通过阈值（加权总分），默认 60 */
  passThreshold?: number;
  /** 自动重写（默认 true；关闭则未通过直接转人工） */
  autoRewrite?: boolean;
  /** 自动重写最大轮次，默认 2 */
  maxRounds?: number;
  context?: ReviewInput["context"];
  /** 产物入池（**不替换正文**） */
  onVersion: (v: ReviewArtifact) => void;
}

/** 运行评审回路：初版评分 →（未通过且可自动重写）反馈注入重写 → 复审 → 入池；返回是否转人工 */
export async function runReviewLoop(
  opts: ReviewLoopOptions,
): Promise<{ needsHuman: boolean; rounds: number }> {
  const passThreshold = opts.passThreshold ?? 60;
  const autoRewrite = opts.autoRewrite ?? true;
  const maxRounds = Math.max(0, opts.maxRounds ?? 2);

  const evaluateAll = async (content: string): Promise<EvaluationBundle> => {
    const results: EvaluationBundle = {};
    for (const dimension of REVIEW_DIMENSIONS) {
      // 未注册维度不参与（缺维由 aggregate 忽略）
      if (!opts.evaluators.has(dimension)) {
        continue;
      }
      const input: ReviewInput = { dimension, content, model: opts.model, temperature: 0 };
      if (opts.context) {
        input.context = opts.context;
      }
      results[dimension] = await evaluateWithFallback(opts.evaluators.resolve(dimension), input);
    }
    return results;
  };

  let content = opts.content;
  let round = 0;
  let results = await evaluateAll(content);
  opts.onVersion({ id: "v0", label: "初版", content, round, results });

  let needsHuman = false;
  let total = weightedTotal(results, opts.weights);

  while (total < passThreshold) {
    const failedDims = REVIEW_DIMENSIONS.filter((dimension) => {
      const result = results[dimension];
      return result !== undefined && result.score < passThreshold;
    });
    // 合规低分仅人工裁决：不参与自动重写触发
    const triggerDims = failedDims.filter((dimension) => dimension !== "compliance");

    if (!autoRewrite || triggerDims.length === 0 || round >= maxRounds) {
      // 关闭自动重写 / 仅合规未通过 / 达上限 → 转人工
      needsHuman = true;
      break;
    }

    round += 1;
    const feedback: FailedDimensionFeedback[] = [];
    for (const dimension of triggerDims) {
      const result = results[dimension];
      if (!result) {
        continue;
      }
      feedback.push({ dimension, score: result.score, reasons: result.reasons });
    }

    content = await rewriteChapter({
      provider: opts.provider,
      model: opts.model,
      rewrite: { content, feedback },
    });
    results = await evaluateAll(content);
    opts.onVersion({ id: `v${round}`, label: `重写${round}`, content, round, results });
    total = weightedTotal(results, opts.weights);
  }

  return { needsHuman, rounds: round };
}

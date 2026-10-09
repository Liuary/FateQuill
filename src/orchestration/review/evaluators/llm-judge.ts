/**
 * LLM-as-judge 评估器工厂（stage-06 T2）
 *
 * 职责：以 stage-03 `ModelProvider` 做**非流式收口**——聚合完整文本后经
 * `parseEvaluationJson` 解析；解析/调用失败抛错，交给 T1 `evaluateWithFallback` 重试与降级。
 * **provider 无关**：不引用任何具体适配器实现（仅依赖 `ModelProvider` 契约）。
 */

import type { ChatOptions, ModelProvider } from "@/orchestration/types";
import type { Evaluator, ReviewDimension } from "../types";
import { trimReviewContent } from "../budget";
import { parseEvaluationJson } from "../json";
import { buildReviewSystemPrompt } from "../rubric";

/** 构造 LLM 判定评估器：`provider.stream` 聚合完整文本 → `parseEvaluationJson` */
export function createLlmJudgeEvaluator(opts: {
  dimension: ReviewDimension;
  provider: ModelProvider;
}): Evaluator {
  const { dimension, provider } = opts;
  return {
    id: dimension,
    async evaluate(input) {
      // 评审正文按预算裁剪（沿用装配预算；长章不全量送模型）
      const content = trimReviewContent(input.content);
      const options: ChatOptions = {
        model: input.model,
        temperature: input.temperature ?? 0,
        messages: [
          { role: "system", content: buildReviewSystemPrompt(dimension) },
          { role: "user", content },
        ],
      };
      let full = "";
      // 非流式收口：聚合全部增量后再解析（不新增流式 UI）
      for await (const chunk of provider.stream(options)) {
        full += chunk.delta;
      }
      return parseEvaluationJson(full);
    },
  };
}

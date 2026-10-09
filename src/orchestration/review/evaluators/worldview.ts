/** 世界观维度评估器（LLM-as-judge）；见 op-003（stage-06 T2） */
import type { ModelProvider } from "@/orchestration/types";
import type { Evaluator } from "../types";
import { createLlmJudgeEvaluator } from "./llm-judge";

/** 构造世界观评估器 */
export function createWorldviewEvaluator(provider: ModelProvider): Evaluator {
  return createLlmJudgeEvaluator({ dimension: "worldview", provider });
}

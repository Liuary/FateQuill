/**
 * 内置评估器注册（stage-06 T2）
 *
 * 职责：把四维评估器注册进 `EvaluatorRegistry`——剧情 / 世界观 / 真人感为 LLM-as-judge
 * （需 `ModelProvider`），合规为规则引擎（无需 Provider）。
 */

import type { ModelProvider } from "@/orchestration/types";
import type { EvaluatorRegistry } from "./evaluator";
import {
  createComplianceEvaluator,
  createHumanityEvaluator,
  createPlotEvaluator,
  createWorldviewEvaluator,
} from "./evaluators";

/** 注册四维内置评估器；返回同一注册表便于链式使用 */
export function registerBuiltinEvaluators(
  registry: EvaluatorRegistry,
  provider: ModelProvider,
): EvaluatorRegistry {
  registry.register(createPlotEvaluator(provider));
  registry.register(createWorldviewEvaluator(provider));
  registry.register(createHumanityEvaluator(provider));
  registry.register(createComplianceEvaluator());
  return registry;
}

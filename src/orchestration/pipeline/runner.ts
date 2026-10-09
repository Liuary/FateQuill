import type { Agent, Chunk, PipelineStep } from "@/orchestration/types";
import type { OrchestrationRegistries } from "@/orchestration/registry";

/** 生成输入：Agent 标识 + 用户提示词 */
export interface GenerationInput {
  agentId: string;
  userInput: string;
}

/** 单 Agent 生成 Step：类型化输入 → Chunk 异步序列 */
export type GenerationStep = PipelineStep<GenerationInput, AsyncIterable<Chunk>>;

/** 顺序执行若干 Step（v0.1 单步；多步组合留待后续阶段，签名保持可组合） */
export async function runSteps(
  steps: GenerationStep[],
  input: GenerationInput,
): Promise<AsyncIterable<Chunk>> {
  let output: AsyncIterable<Chunk> = (async function* () {})();
  for (const step of steps) output = await step.run(input);
  return output;
}

/** 解析 Agent（供 Step 复用） */
export function resolveAgent(reg: OrchestrationRegistries, agentId: string): Agent {
  return reg.agents.resolve(agentId);
}

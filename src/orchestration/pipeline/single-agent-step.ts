import type { Chunk } from "@/orchestration/types";
import type { OrchestrationRegistries } from "@/orchestration/registry";
import { resolveAgent, type GenerationInput, type GenerationStep } from "./runner";

/** 构造「单 Agent 生成」Step：system prompt + user input → provider.stream() */
export function createSingleAgentStep(reg: OrchestrationRegistries): GenerationStep {
  return {
    id: "single-agent",
    async run(input: GenerationInput): Promise<AsyncIterable<Chunk>> {
      const agent = resolveAgent(reg, input.agentId);
      const provider = reg.providers.resolve(agent.modelRef.providerId);
      return provider.stream({
        model: agent.modelRef.model,
        temperature: agent.temperature,
        messages: [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: input.userInput },
        ],
      });
    },
  };
}

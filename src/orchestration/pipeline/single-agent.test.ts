import { describe, expect, it } from "vitest";
import { createRegistries } from "@/orchestration/registry";
import { createSingleAgentStep } from "./single-agent-step";
import { runSteps } from "./runner";
import type { ModelProvider } from "@/orchestration/types";

function fakeProvider(id: string, parts: string[]): ModelProvider {
  return {
    id,
    async *stream() {
      for (const p of parts) yield { delta: p };
    },
  };
}

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

describe("single-agent pipeline", () => {
  it("输入提示词 → 输出流（拼接正确）", async () => {
    const reg = createRegistries();
    reg.providers.register(fakeProvider("openai-compatible", ["你", "好", "，世界"]));
    reg.agents.register({
      id: "writer",
      name: "编著官",
      systemPrompt: "写小说",
      modelRef: { providerId: "openai-compatible", model: "m" },
      temperature: 0.7,
    });
    const step = createSingleAgentStep(reg);
    const stream = await runSteps([step], { agentId: "writer", userInput: "写一句" });
    let text = "";
    for await (const c of stream) text += c.delta;
    expect(text).toBe("你好，世界");
  });

  it("未注册 Agent 抛错", async () => {
    const reg = createRegistries();
    const step = createSingleAgentStep(reg);
    const err = await captureError(runSteps([step], { agentId: "nope", userInput: "x" }));
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/not registered/);
  });
});

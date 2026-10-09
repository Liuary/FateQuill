import { describe, expect, it } from "vitest";
import { createAnthropicProvider } from "./anthropic";
import type { StreamTransport } from "./openai-compatible";
import anthropicSse from "../../../tests/fixtures/anthropic.sse?raw";
import anthropicErrorSse from "../../../tests/fixtures/anthropic.error.sse?raw";

const replay = (text: string): StreamTransport => {
  return async ({ onEvent }) => {
    onEvent({ type: "Chunk", data: text });
    onEvent({ type: "Done" });
    return async () => {};
  };
};

async function collect(text: string): Promise<string> {
  const provider = createAnthropicProvider({
    baseUrl: "https://api.anthropic.com",
    apiKeyLabel: "default",
    transport: replay(text),
  });
  let out = "";
  for await (const c of provider.stream({
    model: "claude-test",
    messages: [{ role: "user", content: "hi" }],
  })) {
    out += c.delta;
  }
  return out;
}

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

describe("anthropic provider", () => {
  it("回放：拼接 content_block_delta 文本，message_stop 终止", async () => {
    expect(await collect(anthropicSse)).toBe("你好，世界");
  });

  it("error 帧抛错", async () => {
    const err = await captureError(collect(anthropicErrorSse));
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/provider error/);
  });
});

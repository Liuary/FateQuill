import { describe, expect, it } from "vitest";
import { createOpenAiCompatibleProvider, type StreamTransport } from "./openai-compatible";
import openAiSse from "../../../tests/fixtures/openai-compatible.sse?raw";
import openAiErrorSse from "../../../tests/fixtures/openai-compatible.error.sse?raw";

/** 夹具回放 transport：把整段文本作为一个 Chunk 发回，随后 Done */
const replay = (text: string): StreamTransport => {
  return async ({ onEvent }) => {
    onEvent({ type: "Chunk", data: text });
    onEvent({ type: "Done" });
    return async () => {};
  };
};

async function collect(text: string): Promise<string> {
  const provider = createOpenAiCompatibleProvider({
    baseUrl: "https://api.example.com",
    apiKeyLabel: "default",
    transport: replay(text),
  });
  let out = "";
  for await (const c of provider.stream({
    model: "test-model",
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

describe("openai-compatible provider", () => {
  it("回放：拼接文本增量并在 [DONE] 终止", async () => {
    expect(await collect(openAiSse)).toBe("Hello, world");
  });

  it("错误帧抛错（脱敏 message）", async () => {
    const err = await captureError(collect(openAiErrorSse));
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/provider error/);
  });
});

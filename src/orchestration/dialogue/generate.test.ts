import { describe, expect, it } from "vitest";
import type { ChatOptions, Chunk, ModelRef } from "@/orchestration/types";
import { generateLine, toCharacterOptions, toNarratorOptions } from "./generate";

const modelRef: ModelRef = { providerId: "openai-compatible", model: "m" };

const stream = (parts: string[]) =>
  (async function* (): AsyncIterable<Chunk> {
    for (const part of parts) {
      yield { delta: part };
    }
  })();

describe("generateLine（非流式收口 · 失败不抛穿）", () => {
  it("聚合全文并 trim", async () => {
    const result = await generateLine({
      options: {} as ChatOptions,
      streamFor: () => stream([" 你", "好。"]),
    });
    expect(result).toEqual({ ok: true, text: "你好。" });
  });

  it("空响应 → ok:false（error=empty-response）", async () => {
    const result = await generateLine({
      options: {} as ChatOptions,
      streamFor: () => stream(["   "]),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("empty-response");
  });

  it("provider 抛错 → ok:false 且**不抛穿**", async () => {
    const boom = (): AsyncIterable<Chunk> => {
      throw new Error("boom"); // provider 取流即失败（无 yield）
    };
    await expect(generateLine({ options: {} as ChatOptions, streamFor: boom })).resolves.toEqual({
      ok: false,
      error: "boom",
    });
  });

  it("abort → ok:false（不抛穿）", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await generateLine({
      options: {} as ChatOptions,
      streamFor: () => stream(["x"]),
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
  });
});

describe("toCharacterOptions / toNarratorOptions（装配链）", () => {
  it("角色：system 含 persona 要素；user = 公共上下文", () => {
    const options = toCharacterOptions({
      profile: { identity: "侠客甲", speechStyle: "冷峻寡言" },
      publicContext: "青灯引航。",
      modelRef,
    });
    expect(options.model).toBe("m");
    expect(options.messages[0].content).toContain("侠客甲");
    expect(options.messages[0].content).toContain("冷峻寡言");
    expect(options.messages[1].content).toBe("青灯引航。");
  });

  it("旁白与角色**仅 system 差异**（user 一致）", () => {
    const character = toCharacterOptions({
      profile: { identity: "甲" },
      publicContext: "前文",
      modelRef,
    });
    const narrator = toNarratorOptions({ publicContext: "前文", modelRef });
    expect(narrator.messages[0].content).not.toBe(character.messages[0].content);
    expect(narrator.messages[1].content).toBe(character.messages[1].content);
  });
});

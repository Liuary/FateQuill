/**
 * 非流式生成收口（stage-10 T2）
 *
 * - `generateLine`：聚合 `Chunk.delta` 全文；**失败不抛穿**（返回 `{ ok, text?, error? }`）；
 * - `toCharacterOptions` / `toNarratorOptions`：由 persona 装配 `ChatOptions`（system = persona + 公共上下文）。
 */

import type { ChatOptions, Chunk, ModelRef } from "@/orchestration/types";
import { buildCharacterAgentInput, type OtherCharacter } from "./context";
import { buildNarratorAgentPrompt } from "./persona";
import type { DialogueProfile } from "./types";

/** 生成结果（失败不抛穿） */
export interface GenerateLineResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/** 非流式收口：聚合全文（空响应视为失败；中断/异常捕获为 `ok:false`） */
export async function generateLine(opts: {
  options: ChatOptions;
  streamFor: (options: ChatOptions) => AsyncIterable<Chunk>;
  signal?: AbortSignal;
}): Promise<GenerateLineResult> {
  try {
    let full = "";
    for await (const chunk of opts.streamFor(opts.options)) {
      if (opts.signal?.aborted) {
        throw new Error("aborted");
      }
      full += chunk.delta;
    }
    const text = full.trim();
    if (!text) {
      return { ok: false, error: "empty-response" };
    }
    return { ok: true, text };
  } catch (error) {
    // 失败不抛穿：调用方据 ok/error 决定 UI 反馈
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 角色台词 `ChatOptions`（**白名单装配**：system = 本人 persona；user = 公共上下文 + 他人公开身份摘要）。
 * **只**经 `buildCharacterAgentInput` 装配——**杜绝**把全量角色列表（含他人 persona）直接传入。
 */
export function toCharacterOptions(input: {
  profile: DialogueProfile;
  publicContext: string;
  modelRef: ModelRef;
  temperature?: number;
  /** 在场其他角色（仅其公开身份摘要进入 prompt） */
  others?: OtherCharacter[];
}): ChatOptions {
  const prompt = buildCharacterAgentInput({
    selfProfile: input.profile,
    publicContext: input.publicContext,
    others: input.others,
  });
  return {
    model: input.modelRef.model,
    temperature: input.temperature ?? 0.7,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  };
}

/** 旁白 `ChatOptions`（与角色台词**仅 system 差异**，装配链一致） */
export function toNarratorOptions(input: {
  publicContext: string;
  modelRef: ModelRef;
  temperature?: number;
}): ChatOptions {
  const prompt = buildNarratorAgentPrompt({ publicContext: input.publicContext });
  return {
    model: input.modelRef.model,
    temperature: input.temperature ?? 0.7,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  };
}

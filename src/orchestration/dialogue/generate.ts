/**
 * 非流式生成收口（stage-10 T2）
 *
 * - `generateLine`：聚合 `Chunk.delta` 全文；**失败不抛穿**（返回 `{ ok, text?, error? }`）；
 * - `toCharacterOptions` / `toNarratorOptions`：由 persona 装配 `ChatOptions`（system = persona + 公共上下文）。
 */

import type { ChatOptions, Chunk, ModelRef } from "@/orchestration/types";
import { DEFAULT_DIALOGUE_CONCURRENCY, runWithConcurrency } from "./concurrency";
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

/** 批量生成的单项结果（**按输入序归位**） */
export interface BatchLineResult {
  participant: { id?: number; name: string };
  ok: boolean;
  text?: string;
  error?: string;
}

/**
 * 批量生成多角色台词：经 `runWithConcurrency`（**并发上限 + 超限排队**）；
 * 每项**仅经白名单装配**（本人 persona + 公共上下文 + 他人**公开身份摘要**）；单项失败不抛穿。
 */
export async function generateBatch(input: {
  /** 参与角色（调用方已按 `major` 过滤） */
  participants: { id?: number; name: string; profile: DialogueProfile }[];
  /** 公共上下文（同场景共享） */
  publicContext: string;
  modelRef: ModelRef;
  streamFor: (options: ChatOptions) => AsyncIterable<Chunk>;
  /** 并发上限（默认 3） */
  limit?: number;
  signal?: AbortSignal;
}): Promise<BatchLineResult[]> {
  const outcomes = await runWithConcurrency(
    input.participants,
    input.limit ?? DEFAULT_DIALOGUE_CONCURRENCY,
    async (participant, index) => {
      const others: OtherCharacter[] = input.participants
        .filter((_, otherIndex) => otherIndex !== index)
        .map((other) => ({ id: other.id, name: other.name, profile: other.profile }));
      const options = toCharacterOptions({
        profile: participant.profile,
        publicContext: input.publicContext,
        modelRef: input.modelRef,
        others,
      });
      const result = await generateLine({
        options,
        streamFor: input.streamFor,
        signal: input.signal,
      });
      if (!result.ok || !result.text) {
        throw new Error(result.error ?? "generate-failed");
      }
      return result.text;
    },
  );

  return outcomes.map((outcome) => ({
    participant: { id: outcome.item.id, name: outcome.item.name },
    ok: outcome.ok,
    text: outcome.value,
    error: outcome.error,
  }));
}

/**
 * 抽取编排（stage-11 T2）
 *
 * 流程：非流式收口 → `parseExtraction`（JSON 容错）→ `verifyEvidence`（**不匹配剔除**）
 * → `dedupeByName`（名称精确去重）。
 *
 * **返回契约定稿**（REV-008②）：
 * - 收口 / 解析异常 → `{ ok:false, candidates: [], error }`（**失败不抛穿**）；
 * - 成功（含零命中）→ `{ ok:true, candidates }`（零命中为**合法空态**）。
 */

import type { ChatOptions, Chunk, ModelRef } from "@/orchestration/types";
import { buildExtractOptions, parseExtraction, verifyEvidence } from "./extract";
import { dedupeByName } from "./dedupe";
import type { ExtractionResult } from "./types";

export interface RunExtractionOptions {
  /** 章节纯文本（与回查使用**同一文本**） */
  chapterText: string;
  /** 既有设定卡名称（去重依据） */
  existingNames: string[];
  modelRef: ModelRef;
  /** 取流（可注入：测试用假实现；生产经 `provider.stream`） */
  streamFor: (options: ChatOptions) => AsyncIterable<Chunk>;
  signal?: AbortSignal;
}

/** 运行一次归档抽取（失败不抛穿；候选不入库直达，由调用方入待确认队列） */
export async function runExtraction(opts: RunExtractionOptions): Promise<ExtractionResult> {
  try {
    let full = "";
    const options = buildExtractOptions({ chapterText: opts.chapterText, modelRef: opts.modelRef });
    // 非流式收口：聚合全文后统一解析
    for await (const chunk of opts.streamFor(options)) {
      if (opts.signal?.aborted) {
        throw new Error("aborted");
      }
      full += chunk.delta;
    }
    const parsed = parseExtraction(full);
    // 防幻觉硬闸：evidence 非原文子串 → 剔除
    const verified = parsed.filter((candidate) => verifyEvidence(candidate, opts.chapterText));
    return { ok: true, candidates: dedupeByName(verified, opts.existingNames) };
  } catch (error) {
    // 收口 / 解析异常：收为 ok:false（UI 据 ok/error 提示失败）
    return {
      ok: false,
      candidates: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

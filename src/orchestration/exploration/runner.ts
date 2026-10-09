/**
 * 多温度并行推演编排（stage-08 T1）
 *
 * 职责：对每个分支**并行**推演（可注入 `streamFor`）、**非流式收口**（聚合全文后解析走向卡）、
 * 结果**按输入顺序归位**（与完成顺序无关）；单分支失败置 `error`（不影响其余分支）；
 * 并发受 `concurrency`（默认 3）约束。
 */

import type { Chunk } from "@/orchestration/types";
import { parseTurnCard } from "./parse";
import type { ExplorationBranch } from "./types";

/** 单分支运行输入（温度三态：请求 / clamp 后 / 是否被 clamp） */
export interface RunBranchInput {
  id: string;
  temperature: number;
  effectiveTemperature: number;
  clamped: boolean;
}

export interface RunExplorationOptions {
  branches: RunBranchInput[];
  /** 分支取流（可注入：测试用假实现；生产经 `provider.stream`） */
  streamFor: (branch: RunBranchInput) => AsyncIterable<Chunk>;
  signal?: AbortSignal;
  /** 并发上限（默认 3；避免无上限并行） */
  concurrency?: number;
}

/** 默认并发上限 */
export const DEFAULT_CONCURRENCY = 3;

/**
 * 并行推演：逐分支聚合 → 解析走向卡；返回**与 `branches` 同序**的分支结果（乱序完成亦正确归位）。
 */
export async function runExploration(opts: RunExplorationOptions): Promise<ExplorationBranch[]> {
  const concurrency = Math.max(1, Math.trunc(opts.concurrency ?? DEFAULT_CONCURRENCY));

  // 结果槽位按输入顺序预置（乱序完成 → 按索引归位）
  const results: ExplorationBranch[] = opts.branches.map((branch) => ({
    id: branch.id,
    temperature: branch.temperature,
    effectiveTemperature: branch.effectiveTemperature,
    clamped: branch.clamped,
    status: "pending",
  }));

  const runBranch = async (index: number) => {
    const input = opts.branches[index];
    const target = results[index];
    try {
      let full = "";
      // 非流式收口：聚合本分支全文
      for await (const chunk of opts.streamFor(input)) {
        if (opts.signal?.aborted) {
          throw new Error("aborted");
        }
        full += chunk.delta;
      }
      target.card = parseTurnCard(full);
      target.status = "done";
    } catch (error) {
      // 单分支失败：**不抛穿**，仅标记该分支
      target.status = "error";
      target.error = error instanceof Error ? error.message : String(error);
    }
  };

  // 工作池：并发上限内并行拉取分支索引；`signal.aborted` → **停止排队**（不再启动新分支）
  let cursor = 0;
  const workerCount = Math.min(concurrency, results.length);
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      if (opts.signal?.aborted) {
        return; // 已中止：排队中的分支不再启动（未启动分支保持 pending）
      }
      const index = cursor;
      cursor += 1;
      if (index >= opts.branches.length) {
        return;
      }
      await runBranch(index);
    }
  });
  await Promise.all(workers);

  return results;
}

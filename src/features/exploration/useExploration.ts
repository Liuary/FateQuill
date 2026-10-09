/**
 * 推演编排（stage-08 T1）
 *
 * 职责：按温度集 × provider clamp 构造分支 → 逐分支装配输入（复用 stage-05 装配）→
 * **并行推演**（`runExploration`）→ 结果入 `explorationStore`；`AbortController` 可停止。
 * **无新增 IPC**（复用 `http_stream`，非流式收口）。
 */

import { useCallback, useRef } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ChatOptions } from "@/orchestration/types";
import { runExploration, type RunBranchInput } from "@/orchestration/exploration/runner";
import { clampTemperature } from "@/orchestration/exploration/temperature";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";
import { useExplorationStore } from "@/store/explorationStore";
import { buildExplorationOptions } from "./build-exploration-options";

/** 推演编排 */
export function useExploration(opts: {
  novelId: number | null;
  chapterId: number | null;
  config: ModelConfig | null;
}) {
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    const config = opts.config;
    const novelId = opts.novelId;
    const { intent, temperatures } = useExplorationStore.getState();
    if (!config || novelId == null || intent.trim().length === 0) {
      return; // 未就绪（无模型配置 / 无作品 / 未填走向意向）：不启动
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // 分支 = 温度集 × provider clamp（越界分支可标注）
    const branches: RunBranchInput[] = temperatures.map((temperature, index) => {
      const { effective, clamped } = clampTemperature(temperature, config.provider);
      return {
        id: `t${index}-${temperature}`,
        temperature,
        effectiveTemperature: effective,
        clamped,
      };
    });

    useExplorationStore.getState().setRunning(true);
    useExplorationStore
      .getState()
      .setBranches(branches.map((branch) => ({ ...branch, status: "pending" })));
    try {
      // 逐分支装配输入（复用 stage-05 装配 + 走向意向；以 effectiveTemperature 下发）
      const optionsByBranch = new Map<string, ChatOptions>();
      for (const branch of branches) {
        optionsByBranch.set(
          branch.id,
          await buildExplorationOptions({
            novelId,
            chapterId: opts.chapterId,
            intent,
            model: config.modelName,
            temperature: branch.effectiveTemperature,
          }),
        );
      }

      const provider = resolveProviderForConfig(config);
      const results = await runExploration({
        branches,
        // 生产经 provider.stream（非流式收口在 runner 内聚合）；无新增 IPC
        streamFor: (branch) => {
          const options = optionsByBranch.get(branch.id);
          if (!options) {
            throw new Error(`missing options for ${branch.id}`);
          }
          return provider.stream({ ...options, signal: controller.signal });
        },
        signal: controller.signal,
      });
      useExplorationStore.getState().setBranches(results);
    } finally {
      abortRef.current = null;
      useExplorationStore.getState().setRunning(false);
    }
  }, [opts.config, opts.novelId, opts.chapterId]);

  /** 停止推演（abort → 各分支提前退出，已完成分支结果保留） */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { run, stop };
}

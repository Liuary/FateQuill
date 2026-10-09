/**
 * 推演编排（stage-08 T1/T3/T5）
 *
 * 职责：按温度集 × provider clamp 构造分支 → 逐分支装配输入（约束并入 system）→ **并行推演**
 * （`runExploration`，并发上限可调、超限排队）→ 产出期**收敛**（偏离标注 + 降权）→ 入 `explorationStore`。
 * 另提供：**成本预估**（启动前显示）、**单分支重试**、**abort 全停**。**无新增 IPC**（复用 `http_stream`）。
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import type { Chunk } from "@/orchestration/types";
import { repositories } from "@/ipc/repositories";
import { converge } from "@/orchestration/exploration/converge";
import { estimateCost } from "@/orchestration/exploration/cost";
import {
  DEFAULT_CONCURRENCY,
  runExploration,
  type RunBranchInput,
} from "@/orchestration/exploration/runner";
import { clampTemperature } from "@/orchestration/exploration/temperature";
import { buildGuideCard, renderGuideText } from "@/orchestration/iching";
import { renderLiurenText } from "@/orchestration/liuren";
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
  /** 并发上限（默认 3；超限排队） */
  const [concurrency, setConcurrency] = useState<number>(DEFAULT_CONCURRENCY);
  const temperatures = useExplorationStore((s) => s.temperatures);

  /** 启动前显示的成本预估（分支数 ×（输出上限 + 输入估算）） */
  const cost = useMemo(() => estimateCost(temperatures.length), [temperatures.length]);

  // 易经开关：取自 **store 单例**（与开关 UI 同源）→ 运行时切换即时生效（BUG-001）
  const ichingEnabled = useExplorationStore((s) => s.ichingEnabled);
  const casting = useExplorationStore((s) => s.casting);

  /**
   * 卦象引导（可选，stage-09 T5）：**关闭或未起卦 → `undefined`**（零副作用；
   * `buildGuideCard`/`renderGuideText` 均**不被调用**）。开启且已起卦 → 并入 system 约束段。
   */
  const hexagramGuide = useMemo(
    () =>
      ichingEnabled && casting ? { text: renderGuideText(buildGuideCard(casting)) } : undefined,
    [ichingEnabled, casting],
  );

  // 大六壬开关与课体（均取自 store 单例）：与易经**并列可选**、可叠加
  const liurenEnabled = useExplorationStore((s) => s.liurenEnabled);
  const liurenChart = useExplorationStore((s) => s.liurenChart);

  /**
   * 大六壬课体引导（可选，stage-12 T1）：**关闭或未起课 → `undefined`**（零副作用；
   * `renderLiurenText` **不被调用**）。开启且已起课 → 并入 system 约束段（与卦象引导并列）。
   */
  const liurenGuide = useMemo(
    () => (liurenEnabled && liurenChart ? { text: renderLiurenText(liurenChart) } : undefined),
    [liurenEnabled, liurenChart],
  );

  /** 装配单分支取流（设定约束并入 system；signal 透传以便中止） */
  const buildStream = useCallback(
    async (
      config: ModelConfig,
      novelId: number,
      controller: AbortController,
      branch: RunBranchInput,
    ): Promise<{ stream: AsyncIterable<Chunk>; injectedSettingCardIds: number[] }> => {
      const { intent } = useExplorationStore.getState();
      const built = await buildExplorationOptions({
        novelId,
        chapterId: opts.chapterId,
        intent,
        model: config.modelName,
        temperature: branch.effectiveTemperature,
        hexagramGuide,
        liurenGuide,
      });
      const provider = resolveProviderForConfig(config);
      return {
        stream: provider.stream({ ...built.options, signal: controller.signal }),
        injectedSettingCardIds: built.settingCardIds,
      };
    },
    [opts.chapterId, hexagramGuide, liurenGuide],
  );

  /** 运行：全部温度分支（并行 + 排队）→ 收敛 → 入 store */
  const run = useCallback(async () => {
    const config = opts.config;
    const novelId = opts.novelId;
    const { intent, temperatures: temps } = useExplorationStore.getState();
    if (!config || novelId == null || intent.trim().length === 0) {
      return; // 未就绪（无模型配置 / 无作品 / 未填走向意向）：不启动
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // 分支 = 温度集 × provider clamp（越界分支可标注）
    const branches: RunBranchInput[] = temps.map((temperature, index) => {
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
      // 逐分支装配输入；收集本次**注入**的设定卡 id 集（供覆盖检查）
      const streams = new Map<string, AsyncIterable<Chunk>>();
      const injectedSettingCardIds = new Set<number>();
      for (const branch of branches) {
        const built = await buildStream(config, novelId, controller, branch);
        streams.set(branch.id, built.stream);
        for (const id of built.injectedSettingCardIds) {
          injectedSettingCardIds.add(id);
        }
      }

      const results = await runExploration({
        branches,
        // 生产经 provider.stream（非流式收口在 runner 内聚合）；无新增 IPC
        streamFor: (branch) => {
          const stream = streams.get(branch.id);
          if (!stream) {
            throw new Error(`missing stream for ${branch.id}`);
          }
          return stream;
        },
        signal: controller.signal,
        concurrency,
      });

      // 产出期收敛（第二层）：覆盖检查 + 存在性校验（过滤幻觉引用）→ 标注 + 降权（**不删不改**）
      const existingSettingCardIds = new Set(
        (await repositories.settingCard.listByNovel(novelId)).map((card) => card.id),
      );
      const converged = converge(results, {
        injectedSettingCardIds: [...injectedSettingCardIds],
        existingSettingCardIds,
      });
      useExplorationStore.getState().setBranches(converged);
    } finally {
      abortRef.current = null;
      useExplorationStore.getState().setRunning(false);
    }
  }, [opts.config, opts.novelId, buildStream, concurrency]);

  /** 单独重试某失败分支（**仅重跑该分支**，不影响其余分支） */
  const retryBranch = useCallback(
    async (branchId: string): Promise<boolean> => {
      const config = opts.config;
      const novelId = opts.novelId;
      if (!config || novelId == null) {
        return false;
      }
      const branch = useExplorationStore.getState().branches.find((item) => item.id === branchId);
      if (!branch) {
        return false;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      useExplorationStore.getState().setRunning(true);
      try {
        const input: RunBranchInput = {
          id: branch.id,
          temperature: branch.temperature,
          effectiveTemperature: branch.effectiveTemperature,
          clamped: branch.clamped,
        };
        const built = await buildStream(config, novelId, controller, input);
        const [result] = await runExploration({
          branches: [input],
          streamFor: () => built.stream,
          signal: controller.signal,
        });
        // 仅更新该分支（同样做存在性校验 + 收敛标注）
        const existingSettingCardIds = new Set(
          (await repositories.settingCard.listByNovel(novelId)).map((card) => card.id),
        );
        const [converged] = converge([result], {
          injectedSettingCardIds: built.injectedSettingCardIds,
          existingSettingCardIds,
        });
        useExplorationStore.getState().updateBranch(branchId, converged);
        return true;
      } finally {
        abortRef.current = null;
        useExplorationStore.getState().setRunning(false);
      }
    },
    [opts.config, opts.novelId, buildStream],
  );

  /** abort **全部停止**（在跑分支经 signal 提前退出；排队分支不再启动） */
  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    run,
    retryBranch,
    abort,
    concurrency,
    setConcurrency,
    cost,
    ichingEnabled,
    /** 大六壬开关（store 单源；供测试/调用方断言运行时切换即时生效） */
    liurenEnabled,
  };
}

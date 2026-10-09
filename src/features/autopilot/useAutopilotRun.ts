/**
 * 全自动运行编排（stage-12 T2）
 *
 * 职责：驱动 `runAutopilot`（**零人工交互**）→ 进度经 `onProgress` 写入 `autopilotStore`（**状态单源**）；
 * 结束时写入 `report`。中止经 `AbortController`（**stop**）。
 */

import { useCallback, useRef } from "react";
import {
  runAutopilot,
  type AutopilotChapterInput,
  type AutopilotConfig,
  type AutopilotDeps,
} from "@/orchestration/autopilot";
import { useAutopilotStore } from "@/store/autopilotStore";

/** 全自动运行编排（依赖由 `useAutopilot` 装配；`deps === null` → 不可启动） */
export function useAutopilotRun(deps: AutopilotDeps | null) {
  const abortRef = useRef<AbortController | null>(null);

  /** 启动整轮（逐章串行；进度实时写入 store） */
  const run = useCallback(
    async (outline: AutopilotChapterInput[], config: AutopilotConfig): Promise<boolean> => {
      if (!deps) {
        return false;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const store = useAutopilotStore.getState();
      store.reset();
      store.setStatus("running");

      try {
        const outcome = await runAutopilot({
          outline,
          config,
          deps,
          signal: controller.signal,
          onProgress: (progress) => useAutopilotStore.getState().setProgress(progress),
        });
        useAutopilotStore.getState().setReport(outcome);
        return !outcome.aborted;
      } catch (error) {
        // 非预期异常：置报告为 null 并落错误态（单章失败已在链内降级）
        useAutopilotStore.getState().setStatus("aborted");
        useAutopilotStore.getState().setReport({
          chapters: useAutopilotStore.getState().chapters,
          passed: 0,
          degraded: 0,
          aborted: true,
        });
        void error;
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [deps],
  );

  /** 停止（abort）：当前章中止，已完成章保留 */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { run, stop };
}

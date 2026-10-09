/**
 * 全自动运行编排（stage-12 T2/T3）
 *
 * 职责：驱动 `runAutopilot`（**零人工交互**）→ 进度经 `onProgress` 写入 `autopilotStore`（**状态单源**）；
 * 结束时写入 `report`；**续跑** `resume(runId)`：载入断点（`config_json` 内含 `config`/`outline` + 章断点）
 * → 从首个非 `done/degraded` 章续跑（**已完成章不重跑**）。
 */

import { useCallback, useRef } from "react";
import {
  defaultAutopilotConfig,
  runAutopilot,
  type AutopilotChapterInput,
  type AutopilotConfig,
  type AutopilotDeps,
  type SettledChapter,
} from "@/orchestration/autopilot";
import { isChapterSettled } from "@/domain/models/autopilot";
import { repositories } from "@/ipc/repositories";
import { useAutopilotStore } from "@/store/autopilotStore";

/** 从 `config_json` 恢复配置与大纲（宽松解析：缺省回落默认配置） */
function restore(configJson: string): {
  config: AutopilotConfig;
  outline: AutopilotChapterInput[];
} {
  try {
    const parsed = JSON.parse(configJson) as {
      config?: Partial<AutopilotConfig>;
      outline?: AutopilotChapterInput[];
    };
    return {
      config: defaultAutopilotConfig(parsed.config ?? {}),
      outline: Array.isArray(parsed.outline) ? parsed.outline : [],
    };
  } catch {
    // 破损 config_json：回退默认配置 + 空大纲（不续跑出错误结果）
    return { config: defaultAutopilotConfig(), outline: [] };
  }
}

/** 全自动运行编排（依赖由 `useAutopilot` 装配；`deps === null` → 不可启动） */
export function useAutopilotRun(deps: AutopilotDeps | null) {
  const abortRef = useRef<AbortController | null>(null);

  /** 启动整轮（逐章串行；进度实时写入 store；熔断/中止即停并出报告） */
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
      } catch {
        // 非预期异常：落中止态（单章失败已在链内降级）
        useAutopilotStore.getState().setStatus("aborted");
        useAutopilotStore.getState().setReport({
          chapters: useAutopilotStore.getState().chapters,
          passed: 0,
          degraded: 0,
          aborted: true,
          conflicts: 0,
        });
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [deps],
  );

  /** **续跑**：载入断点 → 跳过已完成章 → 从中断处继续 */
  const resume = useCallback(
    async (runId: number): Promise<boolean> => {
      if (!deps) {
        return false;
      }
      const run = await repositories.autopilot.getRun(runId);
      const { config, outline } = restore(run.configJson);
      const chapters = await repositories.autopilot.listChapters(runId);
      const completed: SettledChapter[] = chapters.filter(isChapterSettled).map((chapter) => ({
        orderIndex: chapter.orderIndex,
        status: chapter.state === "degraded" ? "degraded" : "done",
        score: chapter.score,
        degradedReason: chapter.degradedReason,
      }));

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
          runId,
          completed, // **不重跑已完成章**
          spentTokens: 0,
          onProgress: (progress) => useAutopilotStore.getState().setProgress(progress),
        });
        useAutopilotStore.getState().setReport(outcome);
        return !outcome.aborted;
      } catch {
        useAutopilotStore.getState().setStatus("aborted");
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [deps],
  );

  /** 停止（abort）：当前章中止，已完成章保留（断点已落库，可续跑） */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { run, resume, stop };
}

/**
 * 交叉判断编排（stage-07 T2 生产接线，REV-018 修复）
 *
 * 职责：对**已有采样候选**逐模型摘取 AI 味片段（`extractFlavorExcerpts`）→ 以 verbatim 精确交集
 * 合并（`mergeByExcerpt`）→ 结果入**待确认队列**（`researchStore.pendingResults`，`sourceType="multi_model_cross"`）。
 *
 * 容错与停止：**单模型摘取失败跳过**（不整体失败）；`AbortController` 可在候选/模型边界中止。
 */

import { useCallback, useRef, useState } from "react";
import { extractFlavorExcerpts, mergeByExcerpt } from "@/orchestration/research/cross-judge";
import type {
  CrossJudgeResult,
  ModelExcerpts,
  SamplingModel,
} from "@/orchestration/research/types";
import { useResearchStore } from "@/store/researchStore";

/** 交叉判断编排 */
export function useCrossJudge(models: SamplingModel[]) {
  const [crossing, setCrossing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runCrossJudge = useCallback(async () => {
    const candidates = useResearchStore.getState().candidates;
    if (candidates.length === 0 || models.length === 0) {
      return; // 无候选 / 无模型：不启动
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setCrossing(true);
    const merged: CrossJudgeResult[] = [];
    try {
      for (const candidate of candidates) {
        if (controller.signal.aborted) {
          break;
        }
        const perModel: ModelExcerpts[] = [];
        for (const model of models) {
          if (controller.signal.aborted) {
            break;
          }
          try {
            perModel.push(
              await extractFlavorExcerpts({
                provider: model.provider,
                model: model.model,
                content: candidate.content,
                temperature: 0,
                signal: controller.signal,
              }),
            );
          } catch {
            // 单模型摘取失败：**容错跳过**（其余模型结果仍参与交集）
          }
        }
        if (perModel.length > 0) {
          merged.push(...mergeByExcerpt(perModel));
        }
      }
      if (merged.length > 0) {
        // 入待确认队列（不入库直达；每项 sourceType="multi_model_cross"）
        useResearchStore.getState().addPendingResults(merged);
      }
    } finally {
      abortRef.current = null;
      setCrossing(false);
    }
  }, [models]);

  /** 停止交叉判断：在候选/模型边界提前退出（已合并结果保留） */
  const stopCrossJudge = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { runCrossJudge, stopCrossJudge, crossing };
}

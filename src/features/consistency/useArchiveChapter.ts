/**
 * 归档本章编排（stage-11 T2）
 *
 * 职责：手动「归档本章」——加载当前章正文 → `runExtraction`（LLM 抽取 + evidence 回查 + 名称去重）
 * → 候选入**会话内存待确认队列**（`archiveStore`，**不入库直达**）；
 * `confirmAndSave()` 才经 `saveExtracted`（**事务批落库**）写入，且**仅 `new` 候选**。
 */

import { useCallback, useRef, useState } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelRef } from "@/orchestration/types";
import { toPlainText } from "@/orchestration/consistency/extract";
import { runExtraction } from "@/orchestration/consistency/run";
import { repositories } from "@/ipc/repositories";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";
import { useArchiveStore } from "@/store/archiveStore";

/** 归档本章编排 */
export function useArchiveChapter(opts: {
  config: ModelConfig | null;
  novelId: number | null;
  chapterId: number | null;
}) {
  const candidates = useArchiveStore((state) => state.candidates);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** 抽取本章设定（不入库）：结果写入待确认队列；失败仅置 `error`（不抛穿） */
  const archiveChapter = useCallback(async () => {
    const { config, novelId, chapterId } = opts;
    if (!config || novelId == null || chapterId == null) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setSavedCount(null);
    try {
      const chapter = await repositories.chapter.get(chapterId);
      const existing = await repositories.settingCard.listByNovel(novelId);
      const modelRef: ModelRef = { providerId: config.provider, model: config.modelName };
      const provider = resolveProviderForConfig(config);
      const result = await runExtraction({
        chapterText: toPlainText(chapter.content),
        existingNames: existing.map((card) => card.title),
        modelRef,
        streamFor: (options) => provider.stream({ ...options, signal: controller.signal }),
        signal: controller.signal,
      });
      if (!result.ok) {
        // 失败提示由面板据 error 呈现（i18n consistency.extractFailed）
        setError(result.error ?? "extract-failed");
        return;
      }
      // 成功（含零命中）：覆盖待确认队列（**不落库**）
      useArchiveStore.getState().setCandidates(result.candidates);
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, [opts]);

  /** 确认落库：**仅 `new` 候选**经事务批创建；成功后清空队列（返回创建条数） */
  const confirmAndSave = useCallback(async (): Promise<number> => {
    const novelId = opts.novelId;
    if (novelId == null) {
      return 0;
    }
    const items = useArchiveStore
      .getState()
      .candidates.filter((candidate) => candidate.status === "new")
      .map((candidate) => ({
        title: candidate.name,
        content: candidate.content,
        kind: candidate.kind,
        tier: candidate.suggestedTier,
      }));
    if (items.length === 0) {
      return 0;
    }
    const created = await repositories.settingCard.saveExtracted(novelId, items);
    useArchiveStore.getState().clear();
    setSavedCount(created.length);
    return created.length;
  }, [opts.novelId]);

  /** 停止抽取（abort） */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { candidates, running, error, savedCount, archiveChapter, confirmAndSave, stop };
}

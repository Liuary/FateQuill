/**
 * 全自动**真机依赖装配**（stage-12 T2）
 *
 * 把既有契约装配为 `AutopilotDeps`（**复用 stage-05 装配 / stage-06 审查 / stage-11 归档**）：
 * - `streamFor`：`resolveProviderForConfig` 的 provider 取流；
 * - `evaluators`：`registerBuiltinEvaluators(createEvaluatorRegistry(), provider)`（stage-06 四维）；
 * - `contextFor`：设定卡（**分级注入过滤**：恒排 `dark`）+ 前章末尾（同 stage-05/08 口径）；
 * - `archiveFn`：stage-11 `runExtraction`（LLM 抽取 + `evidence` 回查 + 名称去重）→ 按配置**自动确认入库**或入**待确认队列**。
 */

import { useMemo } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelRef } from "@/orchestration/types";
import type { ConflictRecord } from "@/domain/models/conflict-record";
import type { AutopilotDeps, AutopilotPromptContext } from "@/orchestration/autopilot/types";
import { toPlainText } from "@/orchestration/consistency/extract";
import { selectInjectableCards } from "@/orchestration/consistency/inject";
import { runExtraction } from "@/orchestration/consistency/run";
import { runL1Rules } from "@/orchestration/consistency/rules";
import { createEvaluatorRegistry } from "@/orchestration/review/evaluator";
import { registerBuiltinEvaluators } from "@/orchestration/review/register";
import { PROMPT_BUDGET } from "@/orchestration/prompts/chapter-generation";
import { repositories } from "@/ipc/repositories";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";
import { useArchiveStore } from "@/store/archiveStore";

/** 去 HTML 标签（与 stage-05/08/11 同口径） */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** 取末尾限长（同 stage-05 `PROMPT_BUDGET.prevTail`） */
function tail(text: string, limit: number = PROMPT_BUDGET.prevTail): string {
  return text.length <= limit ? text : text.slice(text.length - limit);
}

/** 前章末尾（当前卷内 `orderIndex` 紧邻上一章；无前章 → 空串） */
async function previousChapterTail(chapterId: number | null): Promise<string> {
  if (chapterId == null) {
    return "";
  }
  const chapter = await repositories.chapter.get(chapterId);
  const siblings = (await repositories.chapter.listByVolume(chapter.volumeId)).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const index = siblings.findIndex((sibling) => sibling.id === chapter.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  return previous ? tail(stripHtml(previous.content)) : "";
}

/** 装配真机 `AutopilotDeps`（缺模型配置 → `null`，面板禁用启动） */
export function useAutopilot(opts: {
  config: ModelConfig | null;
  novelId: number | null;
  chapterId: number | null;
  /** 归档候选是否自动确认入库（由面板按 `shouldAutoConfirmArchive(config)` 计算） */
  autoConfirmArchive: boolean;
}): { deps: AutopilotDeps | null } {
  const { config, novelId, chapterId, autoConfirmArchive } = opts;

  const deps = useMemo<AutopilotDeps | null>(() => {
    if (!config || novelId == null) {
      return null;
    }
    const provider = resolveProviderForConfig(config);
    const modelRef: ModelRef = { providerId: config.provider, model: config.modelName };
    const evaluators = registerBuiltinEvaluators(createEvaluatorRegistry(), provider);

    const loadContext = async (): Promise<AutopilotPromptContext> => {
      const cards = await repositories.settingCard.listByNovel(novelId);
      return {
        // 分级注入：恒排 `dark` / `temp`（stage-11 T5 白名单）
        settingCards: selectInjectableCards(cards).map((card) => ({
          id: card.id,
          title: card.title,
          content: card.content,
        })),
        previousChapterTail: await previousChapterTail(chapterId),
      };
    };

    return {
      model: config.modelName,
      streamFor: (options) => provider.stream(options),
      evaluators,
      contextFor: () => loadContext(),
      // 断点持久化（迁移 v6）：run / chapter 落库 → **中断后可续跑**
      persistence: {
        saveRun: async ({ runId, status, configJson }) => {
          const saved = await repositories.autopilot.saveRun({
            ...(runId === undefined ? {} : { id: runId }),
            novelId,
            status,
            configJson,
          });
          return saved.id;
        },
        saveChapter: async (input) => {
          await repositories.autopilot.saveChapter({
            runId: input.runId,
            orderIndex: input.orderIndex,
            state: input.state,
            score: input.score ?? null,
            degradedReason: input.degradedReason ?? "",
            attempt: input.attempt ?? 0,
          });
        },
      },
      // 冲突策略端口：检测复用 stage-11 `runL1Rules`；落库走 `conflict_record`
      // （IPC `save_conflict_record` / `resolve_conflict_record`）
      detectConflicts: async () => {
        const cards = await repositories.settingCard.listByNovel(novelId);
        return runL1Rules(
          cards.map((card) => ({ id: card.id, title: card.title, content: card.content })),
        );
      },
      conflictSink: {
        saveConflictRecord: async (record) => {
          const saved = await repositories.conflictRecord.save({
            novelId,
            aId: record.aId,
            bId: record.bId,
            type: record.type as ConflictRecord["type"],
            evidence: record.evidence,
            severity: record.severity as ConflictRecord["severity"],
          });
          return saved.id;
        },
        resolveConflictRecord: async (id, action) => {
          await repositories.conflictRecord.resolve(id, action);
        },
      },
      archiveFn: async (_chapter, content) => {
        const chapterText = toPlainText(content);
        if (!chapterText) {
          return;
        }
        const cards = await repositories.settingCard.listByNovel(novelId);
        const result = await runExtraction({
          chapterText,
          existingNames: cards.map((card) => card.title),
          modelRef,
          streamFor: (options) => provider.stream(options),
        });
        if (!result.ok || result.candidates.length === 0) {
          return;
        }
        const items = result.candidates
          .filter((candidate) => candidate.status === "new")
          .map((candidate) => ({
            title: candidate.name,
            content: candidate.content,
            kind: candidate.kind,
            tier: candidate.suggestedTier,
          }));
        if (items.length === 0) {
          return;
        }
        if (autoConfirmArchive) {
          // 自动确认：**事务批落库**
          await repositories.settingCard.saveExtracted(novelId, items);
          return;
        }
        // 待人工：入**会话内存待确认队列**（不落库）
        useArchiveStore.getState().setCandidates(result.candidates);
      },
    };
  }, [config, novelId, chapterId, autoConfirmArchive]);

  return { deps };
}

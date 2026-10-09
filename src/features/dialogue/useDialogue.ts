/**
 * 对话生成编排（stage-10 T2）
 *
 * 职责：**旁白 / 对话分离生成**——旁白与角色台词各自独立入口，均为**非流式收口**；
 * 生成结果追加到 `dialogueStore`（会话内存），轮次**用户主导**（可反复）。
 * 持 `AbortController` 支持停止；失败不抛穿（`error` 供 UI 反馈）。
 *
 * 公共场景上下文（**单源**）：经 `@/orchestration/dialogue/context` 的 `buildPublicContext` 装配
 * **设定卡 + 前章末尾 + 场景指令 + 公共对话历史**四块（op-009 / BUG-001 修复）。
 */

import { useCallback, useRef, useState } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelRef } from "@/orchestration/types";
import {
  generateBatch,
  generateLine,
  toCharacterOptions,
  toNarratorOptions,
} from "@/orchestration/dialogue/generate";
import { DEFAULT_DIALOGUE_CONCURRENCY } from "@/orchestration/dialogue/concurrency";
import { buildPublicContext, type PublicHistoryEntry } from "@/orchestration/dialogue/context";
import type { DialogueProfile } from "@/orchestration/dialogue/types";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";
import { useDialogueStore } from "@/store/dialogueStore";
import type { SceneContextInput } from "./scene-context";

/** 角色台词目标 */
export interface DialogueSpeaker {
  id: number;
  name: string;
  profile: DialogueProfile;
}

/** 对话生成编排 */
export function useDialogue(opts: { config: ModelConfig | null; scene: SceneContextInput }) {
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 批量生成并发上限（默认 3；超限排队） */
  const [concurrency, setConcurrency] = useState<number>(DEFAULT_DIALOGUE_CONCURRENCY);

  /**
   * 公共场景上下文（**单源装配**）：设定卡 + 前章末尾 + 场景指令（来自 `useSceneContext`）
   * + 公共对话历史（实时从会话 store 取，保持条目顺序）。
   */
  const assemblePublicContext = useCallback(() => {
    const history: PublicHistoryEntry[] = useDialogueStore.getState().entries.map((entry) => {
      const speaker = entry.kind === "dialogue" ? entry.speakerName : undefined;
      return speaker ? { speaker, content: entry.content } : { content: entry.content };
    });
    return buildPublicContext({
      settingCards: opts.scene.settingCards,
      previousChapterTail: opts.scene.previousChapterTail,
      sceneInstruction: opts.scene.sceneInstruction,
      history,
    });
  }, [opts.scene]);

  const generate = useCallback(
    async (
      kind: "narration" | "dialogue",
      speaker?: DialogueSpeaker,
      others: DialogueSpeaker[] = [],
    ): Promise<boolean> => {
      const config = opts.config;
      if (!config) {
        setError("no-config");
        return false;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      useDialogueStore.getState().setRunning(true);
      setError(null);
      try {
        const modelRef: ModelRef = { providerId: config.provider, model: config.modelName };
        const publicContext = assemblePublicContext();
        // 旁白与角色台词**分别装配**（仅 system 差异）
        const options =
          kind === "narration"
            ? toNarratorOptions({ publicContext, modelRef })
            : toCharacterOptions({
                profile: speaker?.profile ?? {},
                publicContext,
                modelRef,
                // 白名单（T5）：在场他人**仅公开身份摘要**入 prompt，绝不传其 persona 细节
                others: others.map((other) => ({
                  id: other.id,
                  name: other.name,
                  profile: other.profile,
                })),
              });

        const provider = resolveProviderForConfig(config);
        const result = await generateLine({
          options,
          streamFor: (chatOptions) =>
            provider.stream({ ...chatOptions, signal: controller.signal }),
          signal: controller.signal,
        });
        if (!result.ok || !result.text) {
          setError(result.error ?? "generate-failed");
          return false;
        }
        useDialogueStore.getState().addEntry({
          kind,
          speakerId: speaker?.id,
          speakerName: speaker?.name,
          content: result.text,
        });
        return true;
      } finally {
        abortRef.current = null;
        useDialogueStore.getState().setRunning(false);
      }
    },
    [opts.config, assemblePublicContext],
  );

  const generateNarration = useCallback(() => generate("narration"), [generate]);
  const generateCharacterLine = useCallback(
    (speaker: DialogueSpeaker, others: DialogueSpeaker[] = []) =>
      generate("dialogue", speaker, others),
    [generate],
  );

  /** 停止生成（abort） */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * 批量生成多角色台词：经 `runWithConcurrency`（**并发上限 + 超限排队**）；
   * 结果按输入序追加条目（单项失败跳过、不抛穿）；返回成功条数。
   */
  const generateBatchLines = useCallback(
    async (participants: DialogueSpeaker[]): Promise<number> => {
      const config = opts.config;
      if (!config || participants.length === 0) {
        return 0;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      useDialogueStore.getState().setRunning(true);
      setError(null);
      try {
        const modelRef: ModelRef = { providerId: config.provider, model: config.modelName };
        const provider = resolveProviderForConfig(config);
        const results = await generateBatch({
          participants,
          publicContext: assemblePublicContext(),
          modelRef,
          streamFor: (chatOptions) =>
            provider.stream({ ...chatOptions, signal: controller.signal }),
          limit: concurrency,
          signal: controller.signal,
        });
        let added = 0;
        for (const result of results) {
          if (result.ok && result.text) {
            useDialogueStore.getState().addEntry({
              kind: "dialogue",
              speakerId: result.participant.id,
              speakerName: result.participant.name,
              content: result.text,
            });
            added += 1;
          }
        }
        if (added === 0) {
          setError("generate-failed");
        }
        return added;
      } finally {
        abortRef.current = null;
        useDialogueStore.getState().setRunning(false);
      }
    },
    [opts.config, assemblePublicContext, concurrency],
  );

  return {
    generateNarration,
    generateCharacterLine,
    generateBatchLines,
    stop,
    error,
    concurrency,
    setConcurrency,
  };
}

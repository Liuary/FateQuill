/**
 * 对话生成编排（stage-10 T2）
 *
 * 职责：**旁白 / 对话分离生成**——旁白与角色台词各自独立入口，均为**非流式收口**；
 * 生成结果追加到 `dialogueStore`（会话内存），轮次**用户主导**（可反复）。
 * 持 `AbortController` 支持停止；失败不抛穿（`error` 供 UI 反馈）。
 */

import { useCallback, useRef, useState } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelRef } from "@/orchestration/types";
import {
  generateLine,
  toCharacterOptions,
  toNarratorOptions,
} from "@/orchestration/dialogue/generate";
import type { DialogueProfile } from "@/orchestration/dialogue/types";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";
import { useDialogueStore } from "@/store/dialogueStore";

/** 角色台词目标 */
export interface DialogueSpeaker {
  id: number;
  name: string;
  profile: DialogueProfile;
}

/** 对话生成编排 */
export function useDialogue(opts: { config: ModelConfig | null }) {
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 最小公共上下文接线（同装配链）：既有条目按顺序拼接；
   * op-006 的 `buildPublicContext`（设定卡/前文/角色卡）将在此之上替换实现。
   */
  const buildPublicContext = useCallback(() => {
    return useDialogueStore
      .getState()
      .entries.map((entry) =>
        entry.kind === "dialogue" ? `${entry.speakerName ?? ""}：${entry.content}` : entry.content,
      )
      .join("\n");
  }, []);

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
        const publicContext = buildPublicContext();
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
    [opts.config, buildPublicContext],
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

  return { generateNarration, generateCharacterLine, stop, error };
}

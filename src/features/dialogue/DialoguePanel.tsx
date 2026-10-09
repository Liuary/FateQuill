/**
 * 多声部对话面板（stage-10 T2）
 *
 * 职责：装配「旁白区 + 对话区 + 公共历史视图」——旁白与角色台词**可分别生成、分别编辑**；
 * 轮次用户主导（选中角色 → 生成 → 追加历史 → 可反复）。
 *
 * 对话历史**会话内存**（不落库）；合并落章见后续 op（T3）。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Character } from "@/domain/models/character";
import { normalizeProfile } from "@/orchestration/dialogue/profile";
import type { DialogueProfile } from "@/orchestration/dialogue/types";
import { repositories } from "@/ipc/repositories";
import { ConfirmInline } from "@/features/exploration/ConfirmInline";
import { useGenerationAvailability } from "@/features/generation/useGenerationAvailability";
import { useDialogueStore } from "@/store/dialogueStore";
import { CharacterLineComposer } from "./CharacterLineComposer";
import { DialogueEntryList } from "./DialogueEntryList";
import { NarrationComposer } from "./NarrationComposer";
import { useDialogue } from "./useDialogue";
import { useDialogueCost } from "./useDialogueCost";
import { useMergeDialogue } from "./useMergeDialogue";

export interface DialoguePanelProps {
  novelId: number | null;
  chapterId?: number | null;
  /** 次路径「替换当前章」需要（单条撤销） */
  editor?: Editor | null;
}

/** 角色档案（加载既有角色，persona 取自 `profile` JSON） */
async function loadCharacters(novelId: number): Promise<Character[]> {
  return repositories.character.listByNovel(novelId);
}

/** 多声部对话面板 */
export function DialoguePanel({ novelId, chapterId = null, editor = null }: DialoguePanelProps) {
  const { t } = useTranslation("dialogue");
  const { state, config } = useGenerationAvailability();
  const running = useDialogueStore((s) => s.running);
  const entryCount = useDialogueStore((s) => s.entries.length);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [merging, setMerging] = useState(false); // 次路径二次确认门
  const [merged, setMerged] = useState(false);
  const [majorOnly, setMajorOnly] = useState(false); // 「仅主要角色」过滤
  const {
    generateNarration,
    generateCharacterLine,
    generateBatchLines,
    stop,
    error,
    concurrency,
    setConcurrency,
  } = useDialogue({ config });
  const { participants, estimate } = useDialogueCost(characters, { majorOnly });
  const { mergeAsNextChapter, replaceCurrentChapter, error: mergeError } = useMergeDialogue(editor);

  useEffect(() => {
    let alive = true;
    if (novelId == null) {
      return;
    }
    void loadCharacters(novelId).then(
      (result) => {
        if (alive) {
          setCharacters(result);
        }
      },
      () => {
        // 读取失败（IPC 未就绪）：空态（仍可生成旁白）
        if (alive) {
          setCharacters([]);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [novelId]);

  return (
    <div data-testid="dialogue-panel" className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>

      {(state === "no-config" || state === "no-key") && (
        <p className="text-destructive">{t("guideSettings")}</p>
      )}

      <NarrationComposer running={running} onGenerate={() => void generateNarration()} />

      {/* 成本与并发（**启动前显示**；口径注明） */}
      <section data-testid="dialogue-config" className="flex flex-col gap-1 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            data-testid="major-only"
            checked={majorOnly}
            onChange={(event) => setMajorOnly(event.target.checked)}
          />
          {t("majorOnly")}
        </label>
        <label className="flex items-center gap-1">
          {t("concurrency")}
          <Input
            type="number"
            min={1}
            max={10}
            className="w-16"
            value={concurrency}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value >= 1) {
                setConcurrency(Math.trunc(value));
              }
            }}
          />
        </label>
        <span data-testid="dialogue-cost" className="opacity-70">
          {t("cost")}: {estimate.tokens} tokens（{estimate.note}）
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={running || participants.length === 0}
            onClick={() =>
              void generateBatchLines(
                participants.map((character) => ({
                  id: character.id,
                  name: character.name,
                  profile: normalizeProfile(character.profile as DialogueProfile),
                })),
              )
            }
          >
            {t("batchLines")}
          </Button>
          {running && <span className="opacity-70">{t("queued")}</span>}
        </div>
      </section>
      <CharacterLineComposer
        characters={characters}
        running={running}
        onGenerate={(character) =>
          void generateCharacterLine(
            {
              id: character.id,
              name: character.name,
              profile: character.profile as DialogueProfile,
            },
            // 白名单（T5）：在场其他角色仅传公开身份摘要所需字段（prompt 层不再含其 persona 细节）
            characters
              .filter((other) => other.id !== character.id)
              .map((other) => ({
                id: other.id,
                name: other.name,
                profile: other.profile as DialogueProfile,
              })),
          )
        }
      />

      {running && (
        <Button variant="outline" className="self-start" onClick={stop}>
          {t("stop")}
        </Button>
      )}
      {error && <p className="text-destructive text-xs">{t("generateFailed")}</p>}

      <section className="flex flex-col gap-1">
        <h3 className="text-xs opacity-70">{t("history")}</h3>
        <DialogueEntryList />
      </section>

      <section data-testid="merge-section" className="flex flex-col gap-2">
        <h3 className="text-xs opacity-70">{t("merge")}</h3>
        <div className="flex flex-wrap gap-2">
          {/* 主路径：新建下一章草稿（不改当前章） */}
          <Button
            variant="outline"
            disabled={entryCount === 0 || chapterId == null}
            onClick={() => {
              if (chapterId == null) return;
              void mergeAsNextChapter(chapterId).then((ok) => setMerged(ok));
            }}
          >
            {t("mergeNextChapter")}
          </Button>
          {/* 次路径：替换当前章（危险；二次确认 + 强制快照） */}
          <Button
            variant="outline"
            disabled={entryCount === 0 || chapterId == null || editor == null}
            onClick={() => setMerging(true)}
          >
            {t("mergeReplace")}
          </Button>
        </div>

        {merging && (
          <ConfirmInline
            prompt={t("mergeConfirm")}
            onConfirm={() => {
              setMerging(false);
              setMerged(replaceCurrentChapter(chapterId, editor?.getHTML() ?? ""));
            }}
            onCancel={() => setMerging(false)}
          />
        )}

        {merged && <p className="text-xs opacity-70">{t("mergeDone")}</p>}
        {mergeError && <p className="text-destructive text-xs">{t("mergeFailed")}</p>}
      </section>
    </div>
  );
}

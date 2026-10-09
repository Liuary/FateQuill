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
import { Button } from "@/components/ui/button";
import type { Character } from "@/domain/models/character";
import type { DialogueProfile } from "@/orchestration/dialogue/types";
import { repositories } from "@/ipc/repositories";
import { useGenerationAvailability } from "@/features/generation/useGenerationAvailability";
import { useDialogueStore } from "@/store/dialogueStore";
import { CharacterLineComposer } from "./CharacterLineComposer";
import { DialogueEntryList } from "./DialogueEntryList";
import { NarrationComposer } from "./NarrationComposer";
import { useDialogue } from "./useDialogue";

export interface DialoguePanelProps {
  novelId: number | null;
}

/** 角色档案（加载既有角色，persona 取自 `profile` JSON） */
async function loadCharacters(novelId: number): Promise<Character[]> {
  return repositories.character.listByNovel(novelId);
}

/** 多声部对话面板 */
export function DialoguePanel({ novelId }: DialoguePanelProps) {
  const { t } = useTranslation("dialogue");
  const { state, config } = useGenerationAvailability();
  const running = useDialogueStore((s) => s.running);
  const [characters, setCharacters] = useState<Character[]>([]);
  const { generateNarration, generateCharacterLine, stop, error } = useDialogue({ config });

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
      <CharacterLineComposer
        characters={characters}
        running={running}
        onGenerate={(character) =>
          void generateCharacterLine({
            id: character.id,
            name: character.name,
            profile: character.profile as DialogueProfile,
          })
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
    </div>
  );
}

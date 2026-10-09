/**
 * 角色台词生成入口（stage-10 T2）
 *
 * **旁白 / 对话分离**：选中说话角色后触发该角色的台词生成（与旁白入口独立）；
 * 轮次**用户主导**（可反复生成，逐条追加历史）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Character } from "@/domain/models/character";

export interface CharacterLineComposerProps {
  characters: Character[];
  running: boolean;
  onGenerate: (character: Character) => void;
}

/** 角色台词生成入口 */
export function CharacterLineComposer({
  characters,
  running,
  onGenerate,
}: CharacterLineComposerProps) {
  const { t } = useTranslation("dialogue");
  const [speakerId, setSpeakerId] = useState("");
  const selected = characters.find((character) => String(character.id) === speakerId) ?? null;

  return (
    <div
      data-testid="character-line-composer"
      className="border-border/40 flex flex-col gap-1 rounded border p-2"
    >
      <label className="flex items-center gap-1 text-xs">
        {t("speaker")}
        <select
          className="border-input rounded border p-1"
          value={speakerId}
          onChange={(event) => setSpeakerId(event.target.value)}
        >
          <option value="">{t("selectSpeaker")}</option>
          {characters.map((character) => (
            <option key={character.id} value={String(character.id)}>
              {character.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="outline"
        className="self-start"
        disabled={running || !selected}
        onClick={() => selected && onGenerate(selected)}
      >
        {t("generateLine")}
      </Button>
      {characters.length === 0 && <p className="text-xs opacity-70">{t("noCharacters")}</p>}
    </div>
  );
}

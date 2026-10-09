/**
 * 角色管理面板（stage-10 T4）
 *
 * 职责：角色列表 + 新增 / 编辑 / 删除（删除经 `ConfirmInline` 二次确认）；
 * CRUD 复用既有 `character` 命令（**无 IPC 增量**、**零迁移**）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ConfirmInline } from "@/features/exploration/ConfirmInline";
import { CharacterForm } from "./CharacterForm";
import { useCharacters, type CharacterWithProfile } from "./useCharacters";

export interface CharactersPanelProps {
  novelId: number | null;
}

/** 角色管理面板 */
export function CharactersPanel({ novelId }: CharactersPanelProps) {
  const { t } = useTranslation("characters");
  const { characters, state, create, update, remove } = useCharacters(novelId);
  // undefined = 未开启表单；null = 新增；对象 = 编辑
  const [editing, setEditing] = useState<CharacterWithProfile | null | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <div data-testid="characters-panel" className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>

      <Button
        variant="outline"
        className="self-start"
        disabled={novelId == null}
        onClick={() => setEditing(null)}
      >
        {t("add")}
      </Button>

      {editing !== undefined && (
        <CharacterForm
          initial={editing ?? undefined}
          onSubmit={async (input) => {
            const ok = editing ? await update(editing.id, input) : await create(input);
            if (ok) {
              setEditing(undefined);
            }
          }}
          onCancel={() => setEditing(undefined)}
        />
      )}

      {state === "loading" ? (
        <p className="text-xs opacity-70">{t("loading")}</p>
      ) : characters.length === 0 ? (
        <p className="text-xs opacity-70">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {characters.map((character) => (
            <li
              key={character.id}
              data-testid="character-row"
              className="border-border/40 flex flex-col gap-1 rounded border p-1"
            >
              <span>
                {character.name}
                {character.profile.major ? ` ｜ ${t("majorBadge")}` : ""}
              </span>
              <span className="text-xs opacity-70">
                {character.profile.identity} ｜ {character.profile.speechStyle}
              </span>
              <span className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setEditing(character)}>
                  {t("edit")}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDeleteId(character.id)}>
                  {t("delete")}
                </Button>
              </span>
              {confirmDeleteId === character.id && (
                <ConfirmInline
                  prompt={t("confirmDelete")}
                  onConfirm={() => {
                    setConfirmDeleteId(null);
                    void remove(character.id);
                  }}
                  onCancel={() => setConfirmDeleteId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

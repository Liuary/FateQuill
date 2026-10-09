/**
 * 角色表单（stage-10 T4）
 *
 * 职责：编辑角色名与其 `profile` **最小字段**（`identity / personality / speechStyle / goal / extra`
 * 文本 + `major` 勾选）→ 组装 `profile` 对象交给 `onSubmit`（create/update）。
 *
 * 表单字段即 `CHARACTER_PROFILE_KEYS` 的**契约锚点**（同源供给对应 Agent 的 persona）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PROFILE_TEXT_KEYS } from "@/orchestration/dialogue/profile";
import { normalizeProfile } from "@/orchestration/dialogue/profile";
import type { CharacterProfileTextField, DialogueProfile } from "@/orchestration/dialogue/types";
import type { CharacterInput, CharacterWithProfile } from "./useCharacters";

export interface CharacterFormProps {
  initial?: CharacterWithProfile;
  onSubmit: (input: CharacterInput) => Promise<void>;
  onCancel: () => void;
}

/** 文本字段 → i18n 文案键 */
const FIELD_LABEL_KEYS: Record<CharacterProfileTextField, string> = {
  identity: "identity",
  personality: "personality",
  speechStyle: "speechStyle",
  goal: "goal",
  extra: "extra",
};

/** 角色表单（新增 / 编辑） */
export function CharacterForm({ initial, onSubmit, onCancel }: CharacterFormProps) {
  const { t } = useTranslation("characters");
  const [name, setName] = useState(initial?.name ?? "");
  const [profile, setProfile] = useState<DialogueProfile>(initial?.profile ?? normalizeProfile({}));
  const [busy, setBusy] = useState(false);

  const setField = (key: CharacterProfileTextField, value: string) =>
    setProfile((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!name.trim()) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name, profile });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("name")}
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        {PROFILE_TEXT_KEYS.map((key) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            {t(FIELD_LABEL_KEYS[key])}
            <Input
              value={profile[key] ?? ""}
              onChange={(event) => setField(key, event.target.value)}
            />
          </label>
        ))}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.major === true}
            onChange={(event) =>
              setProfile((current) => ({ ...current, major: event.target.checked }))
            }
          />
          {t("major")}
        </label>

        <div className="flex gap-2">
          <Button disabled={busy} onClick={submit}>
            {t("save")}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

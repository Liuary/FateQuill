import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SettingCard } from "@/domain/models/setting-card";
import type { SettingCardInput } from "./useSettingCards";

export interface SettingCardFormProps {
  initial?: SettingCard;
  onSubmit: (input: SettingCardInput) => Promise<void>;
  onCancel: () => void;
}

/** 设定卡新增/编辑表单（title / content / kind） */
export function SettingCardForm({ initial, onSubmit, onCancel }: SettingCardFormProps) {
  const { t } = useTranslation("settingCards");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "general");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ title, content, kind });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("name")}
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("kind")}
          <Input value={kind} onChange={(e) => setKind(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("content")}
          <Input value={content} onChange={(e) => setContent(e.target.value)} />
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

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SETTING_CARD_KINDS, type SettingCard } from "@/domain/models/setting-card";
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

  // 受控枚举选项；若既有卡的 kind 不在值域内，**追加保留选项**（不丢历史值）
  const knownKinds = SETTING_CARD_KINDS as readonly string[];
  const kindOptions = knownKinds.includes(kind) ? [...knownKinds] : [kind, ...knownKinds];

  /** 选项展示：受控值走 i18n，历史自定义值原样显示 */
  const kindLabel = (value: string) => (knownKinds.includes(value) ? t(`kinds.${value}`) : value);

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
          <select
            className="border-input rounded border p-1 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {kindOptions.map((value) => (
              <option key={value} value={value}>
                {kindLabel(value)}
              </option>
            ))}
          </select>
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

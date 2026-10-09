import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_SETTING_CARD_TIER,
  SETTING_CARD_KINDS,
  SETTING_CARD_TIERS,
  type SettingCard,
  type SettingCardTier,
} from "@/domain/models/setting-card";
import type { SettingCardInput } from "./useSettingCards";

export interface SettingCardFormProps {
  initial?: SettingCard;
  /** 冲突处置「编辑设定卡」的定位（`length === 0` → 光标置于卡首） */
  highlight?: { index: number; length: number };
  onSubmit: (input: SettingCardInput) => Promise<void>;
  onCancel: () => void;
}

/** 设定卡新增/编辑表单（title / kind / tier / content；支持按 `highlight` 选中片段） */
export function SettingCardForm({ initial, highlight, onSubmit, onCancel }: SettingCardFormProps) {
  const { t } = useTranslation("settingCards");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "general");
  // 分级（四级，与 `kind` 正交）：新增 → 缺省 conservative `short`；编辑 → 既有值
  const [tier, setTier] = useState<SettingCardTier>(initial?.tier ?? DEFAULT_SETTING_CARD_TIER);
  const [busy, setBusy] = useState(false);
  const contentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 冲突处置跳转定位：选中 `evidence` 命中区间；未命中（length 0）→ 光标回退卡首
    const input = contentRef.current;
    if (!input || !highlight) {
      return;
    }
    const start = Math.max(0, Math.min(highlight.index, input.value.length));
    const end = Math.min(start + highlight.length, input.value.length);
    input.focus();
    input.setSelectionRange(start, end);
  }, [highlight]);

  // 受控枚举选项；若既有卡的 kind 不在值域内，**追加保留选项**（不丢历史值）
  const knownKinds = SETTING_CARD_KINDS as readonly string[];
  const kindOptions = knownKinds.includes(kind) ? [...knownKinds] : [kind, ...knownKinds];

  /** 选项展示：受控值走 i18n，历史自定义值原样显示 */
  const kindLabel = (value: string) => (knownKinds.includes(value) ? t(`kinds.${value}`) : value);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ title, content, kind, tier });
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
          {t("tier")}
          <select
            data-testid="setting-card-tier"
            className="border-input rounded border p-1 text-sm"
            value={tier}
            onChange={(e) => setTier(e.target.value as SettingCardTier)}
          >
            {SETTING_CARD_TIERS.map((value) => (
              <option key={value} value={value}>
                {t(`tiers.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("content")}
          <Input
            ref={contentRef}
            data-testid="setting-card-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
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

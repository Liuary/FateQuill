import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SettingCard } from "@/domain/models/setting-card";
import { SettingCardForm } from "./SettingCardForm";
import { useSettingCards, type SettingCardInput } from "./useSettingCards";

export interface SettingCardsPanelProps {
  novelId: number | null;
}

/** 设定卡面板（列表 / 新增 / 编辑 / 删除；持久化经 stage-02 仓储） */
export function SettingCardsPanel({ novelId }: SettingCardsPanelProps) {
  const { t } = useTranslation("settingCards");
  const { cards, create, update, remove } = useSettingCards(novelId);
  const [editing, setEditing] = useState<SettingCard | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(input: SettingCardInput) {
    await create(input);
    setShowForm(false);
  }
  async function handleUpdate(id: number, input: SettingCardInput) {
    await update(id, input);
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          {t("add")}
        </Button>
      </div>

      {showForm && <SettingCardForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />}
      {editing && (
        <SettingCardForm
          initial={editing}
          onSubmit={(input) => handleUpdate(editing.id, input)}
          onCancel={() => setEditing(null)}
        />
      )}

      {cards.length === 0 && !showForm && <p className="opacity-60">{t("empty")}</p>}

      <div className="flex flex-col gap-2">
        {cards.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-muted-foreground">
                  {c.kind} · {c.content}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                  {t("edit")}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(c.id)}>
                  {t("delete")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

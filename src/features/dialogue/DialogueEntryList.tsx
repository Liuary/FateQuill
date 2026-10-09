/**
 * 对话 / 旁白条目列表（stage-10 T2）
 *
 * 职责：按 `orderIndex` 渲染条目（`dialogue` 前缀 `说话人：`；`narration` 正文），支持**行内编辑**、
 * 上移/下移、删除与在指定位置插入空条目。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialogueStore } from "@/store/dialogueStore";

/** 条目列表 */
export function DialogueEntryList() {
  const { t } = useTranslation("dialogue");
  const entries = useDialogueStore((s) => s.entries);
  const updateEntry = useDialogueStore((s) => s.updateEntry);
  const removeEntry = useDialogueStore((s) => s.removeEntry);
  const moveEntry = useDialogueStore((s) => s.moveEntry);
  const insertAt = useDialogueStore((s) => s.insertAt);

  if (entries.length === 0) {
    return <p className="text-xs opacity-70">{t("empty")}</p>;
  }

  return (
    <ol className="flex flex-col gap-1">
      {entries.map((entry, index) => (
        <li
          key={entry.id}
          data-testid="dialogue-entry"
          data-kind={entry.kind}
          className="border-border/40 flex flex-col gap-1 rounded border p-1"
        >
          <span className="text-xs opacity-70">
            #{entry.orderIndex}{" "}
            {entry.kind === "dialogue"
              ? `${entry.speakerName ?? t("unknownSpeaker")}：`
              : t("narration")}
          </span>
          <Input
            aria-label={`${t("entryContent")}-${index}`}
            value={entry.content}
            onChange={(event) => updateEntry(entry.id, { content: event.target.value })}
          />
          <span className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => moveEntry(entry.id, -1)}>
              {t("moveUp")}
            </Button>
            <Button variant="outline" onClick={() => moveEntry(entry.id, 1)}>
              {t("moveDown")}
            </Button>
            <Button
              variant="outline"
              onClick={() => insertAt(index, { kind: entry.kind, content: "" })}
            >
              {t("insertBefore")}
            </Button>
            <Button variant="outline" onClick={() => removeEntry(entry.id)}>
              {t("delete")}
            </Button>
          </span>
        </li>
      ))}
    </ol>
  );
}

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import type { Chapter } from "@/domain/models/chapter";

export interface OutlineChapterNodeProps {
  chapter: Chapter;
  selected?: boolean;
  onSelect: (id: number) => void;
  onRename: (chapter: Chapter) => void;
  onDelete: (id: number) => void;
}

/** 大纲树 · 章节点（可拖拽） */
export function OutlineChapterNode({
  chapter,
  selected,
  onSelect,
  onRename,
  onDelete,
}: OutlineChapterNodeProps) {
  const { t } = useTranslation("editor");
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `c-${chapter.id}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 pl-4 text-sm ${selected ? "bg-muted" : ""}`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab select-none"
        aria-label={t("drag")}
      >
        ⋮⋮
      </span>
      <button
        type="button"
        className="flex-1 truncate text-left"
        onClick={() => onSelect(chapter.id)}
      >
        {chapter.title}
      </button>
      <button type="button" aria-label={t("rename")} onClick={() => onRename(chapter)}>
        ✎
      </button>
      <button type="button" aria-label={t("delete")} onClick={() => onDelete(chapter.id)}>
        ✕
      </button>
    </div>
  );
}

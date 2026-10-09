import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import type { Volume } from "@/domain/models/volume";
import type { Chapter } from "@/domain/models/chapter";
import { OutlineChapterNode } from "./OutlineChapterNode";

export interface OutlineVolumeNodeProps {
  volume: Volume;
  chapters: Chapter[];
  selectedChapterId: number | null;
  onSelectChapter: (id: number) => void;
  onAddChapter: (volumeId: number) => void;
  onRenameVolume: (volume: Volume) => void;
  onDeleteVolume: (id: number) => void;
  onRenameChapter: (chapter: Chapter) => void;
  onDeleteChapter: (id: number) => void;
}

/** 大纲树 · 卷节点（可拖拽；内含章 SortableContext） */
export function OutlineVolumeNode({
  volume,
  chapters,
  selectedChapterId,
  onSelectChapter,
  onAddChapter,
  onRenameVolume,
  onDeleteVolume,
  onRenameChapter,
  onDeleteChapter,
}: OutlineVolumeNodeProps) {
  const { t } = useTranslation("editor");
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `v-${volume.id}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="border-border/50 rounded-md border py-1">
      <div className="flex items-center gap-1 px-1 text-sm font-medium">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab select-none"
          aria-label={t("drag")}
        >
          ⋮⋮
        </span>
        <span className="flex-1 truncate">{volume.title}</span>
        <button type="button" onClick={() => onAddChapter(volume.id)}>
          {t("addChapter")}
        </button>
        <button type="button" aria-label={t("rename")} onClick={() => onRenameVolume(volume)}>
          ✎
        </button>
        <button type="button" aria-label={t("delete")} onClick={() => onDeleteVolume(volume.id)}>
          ✕
        </button>
      </div>
      <SortableContext
        items={chapters.map((c) => `c-${c.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {chapters.map((c) => (
          <OutlineChapterNode
            key={c.id}
            chapter={c}
            selected={c.id === selectedChapterId}
            onSelect={onSelectChapter}
            onRename={onRenameChapter}
            onDelete={onDeleteChapter}
          />
        ))}
      </SortableContext>
    </div>
  );
}

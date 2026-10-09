import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Chapter } from "@/domain/models/chapter";
import type { Volume } from "@/domain/models/volume";
import { repositories } from "@/ipc/repositories";
import { useEditorStore } from "@/store/editorStore";
import { OutlineVolumeNode } from "./OutlineVolumeNode";
import { computeDropAction, useOutline } from "./useOutline";

export interface OutlineTreeProps {
  novelId: number | null;
  selectedChapterId?: number | null;
}

/** 卷 → 章 大纲树：增删改 + 拖拽排序（落库经 reorder_* 与 move_chapter 命令） */
export function OutlineTree({ novelId, selectedChapterId = null }: OutlineTreeProps) {
  const { t } = useTranslation("editor");
  const { volumes, chaptersByVolume, reload } = useOutline(novelId);
  const setCurrentChapter = useEditorStore((s) => s.setCurrentChapter);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleDragEnd(event: DragEndEvent) {
    if (novelId == null || !event.over) return;
    const action = computeDropAction(
      String(event.active.id),
      String(event.over.id),
      novelId,
      volumes,
      chaptersByVolume,
    );
    if (!action) return;
    if (action.kind === "reorder_volumes") {
      await repositories.volume.reorder(action.novelId, action.orderedIds);
    } else if (action.kind === "reorder_chapters") {
      await repositories.chapter.reorder(action.volumeId, action.orderedIds);
    } else {
      await repositories.chapter.move(action.chapterId, action.toVolumeId, action.toIndex);
    }
    await reload();
  }

  async function addVolume() {
    if (novelId == null) return;
    await repositories.volume.create({
      novelId,
      title: t("newVolume"),
      orderIndex: volumes.length,
    });
    await reload();
  }

  async function addChapter(volumeId: number) {
    await repositories.chapter.create({
      volumeId,
      title: t("newChapter"),
      content: "",
      contentFormat: "html",
      orderIndex: chaptersByVolume[volumeId]?.length ?? 0,
    });
    await reload();
  }

  async function renameVolume(volume: Volume) {
    const next = window.prompt(t("rename"), volume.title);
    if (next == null) return;
    await repositories.volume.update(volume.id, { title: next });
    await reload();
  }

  async function renameChapter(chapter: Chapter) {
    const next = window.prompt(t("rename"), chapter.title);
    if (next == null) return;
    await repositories.chapter.update(chapter.id, {
      title: next,
      content: chapter.content,
      contentFormat: chapter.contentFormat,
      status: chapter.status,
      orderIndex: chapter.orderIndex,
    });
    await reload();
  }

  async function removeVolume(id: number) {
    await repositories.volume.remove(id);
    await reload();
  }

  async function removeChapter(id: number) {
    await repositories.chapter.remove(id);
    await reload();
  }

  function selectChapter(id: number) {
    setCurrentChapter(id);
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-end">
        <button type="button" className="text-sm" onClick={addVolume}>
          {t("addVolume")}
        </button>
      </div>
      {volumes.length === 0 && <p className="text-sm opacity-60">{t("outlineEmpty")}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={volumes.map((v) => `v-${v.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {volumes.map((v) => (
            <OutlineVolumeNode
              key={v.id}
              volume={v}
              chapters={chaptersByVolume[v.id] ?? []}
              selectedChapterId={selectedChapterId}
              onSelectChapter={selectChapter}
              onAddChapter={addChapter}
              onRenameVolume={renameVolume}
              onDeleteVolume={removeVolume}
              onRenameChapter={renameChapter}
              onDeleteChapter={removeChapter}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

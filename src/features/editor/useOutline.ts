import { useCallback, useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type { Volume } from "@/domain/models/volume";
import type { Chapter } from "@/domain/models/chapter";
import { repositories } from "@/ipc/repositories";

/** 拉取某作品的卷 + 按卷分组的章（均按 orderIndex 排序） */
async function loadOutline(novelId: number) {
  const volumes = (await repositories.volume.listByNovel(novelId)).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const chaptersByVolume: Record<number, Chapter[]> = {};
  for (const v of volumes) {
    chaptersByVolume[v.id] = (await repositories.chapter.listByVolume(v.id)).sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
  }
  return { volumes, chaptersByVolume };
}

/** 拖拽结束后的结构动作（纯数据，供持久化与测试） */
export type OutlineDropAction =
  | { kind: "reorder_volumes"; novelId: number; orderedIds: number[] }
  | { kind: "reorder_chapters"; volumeId: number; orderedIds: number[] }
  | { kind: "move_chapter"; chapterId: number; toVolumeId: number; toIndex: number }
  | null;

function parseId(id: string): { type: "v" | "c"; id: number } | null {
  const m = /^([vc])-(\d+)$/.exec(id);
  return m ? { type: m[1] as "v" | "c", id: Number(m[2]) } : null;
}

/**
 * 依据拖拽起止（`v-<id>` / `c-<id>`）计算结构动作：
 * 同层排序 → reorder_*；跨卷章 → move_chapter；跨类型/无位移 → null。
 */
export function computeDropAction(
  activeId: string,
  overId: string,
  novelId: number,
  volumes: Volume[],
  chaptersByVolume: Record<number, Chapter[]>,
): OutlineDropAction {
  const a = parseId(activeId);
  const o = parseId(overId);
  if (!a || !o) return null;

  if (a.type === "v" && o.type === "v") {
    const ids = volumes.map((v) => v.id);
    const from = ids.indexOf(a.id);
    const to = ids.indexOf(o.id);
    if (from < 0 || to < 0 || from === to) return null;
    return { kind: "reorder_volumes", novelId, orderedIds: arrayMove(ids, from, to) };
  }

  if (a.type === "c") {
    const srcVol = volumes.find((v) => (chaptersByVolume[v.id] ?? []).some((c) => c.id === a.id));
    if (!srcVol) return null;

    if (o.type === "c") {
      const dstVol = volumes.find((v) => (chaptersByVolume[v.id] ?? []).some((c) => c.id === o.id));
      if (!dstVol) return null;
      if (srcVol.id === dstVol.id) {
        const ids = (chaptersByVolume[srcVol.id] ?? []).map((c) => c.id);
        const from = ids.indexOf(a.id);
        const to = ids.indexOf(o.id);
        if (from < 0 || to < 0 || from === to) return null;
        return {
          kind: "reorder_chapters",
          volumeId: srcVol.id,
          orderedIds: arrayMove(ids, from, to),
        };
      }
      const toIndex = (chaptersByVolume[dstVol.id] ?? []).findIndex((c) => c.id === o.id);
      return {
        kind: "move_chapter",
        chapterId: a.id,
        toVolumeId: dstVol.id,
        toIndex: Math.max(0, toIndex),
      };
    }

    if (o.type === "v" && srcVol.id !== o.id) {
      return {
        kind: "move_chapter",
        chapterId: a.id,
        toVolumeId: o.id,
        toIndex: (chaptersByVolume[o.id] ?? []).length,
      };
    }
  }

  return null;
}

/** 加载某作品的卷+章（章按卷分组）；提供结构操作后刷新 */
export function useOutline(novelId: number | null) {
  const [state, setState] = useState<{
    novelId: number | null;
    volumes: Volume[];
    chaptersByVolume: Record<number, Chapter[]>;
  }>({ novelId: null, volumes: [], chaptersByVolume: {} });

  useEffect(() => {
    let alive = true;
    if (novelId == null) {
      queueMicrotask(() => {
        if (alive) setState({ novelId: null, volumes: [], chaptersByVolume: {} });
      });
      return () => {
        alive = false;
      };
    }
    void loadOutline(novelId).then((r) => {
      if (alive) setState({ novelId, volumes: r.volumes, chaptersByVolume: r.chaptersByVolume });
    });
    return () => {
      alive = false;
    };
  }, [novelId]);

  const reload = useCallback(async () => {
    if (novelId == null) {
      setState({ novelId: null, volumes: [], chaptersByVolume: {} });
      return;
    }
    const r = await loadOutline(novelId);
    setState({ novelId, volumes: r.volumes, chaptersByVolume: r.chaptersByVolume });
  }, [novelId]);

  const matched = state.novelId === novelId;
  return {
    volumes: matched ? state.volumes : [],
    chaptersByVolume: matched ? state.chaptersByVolume : {},
    reload,
  };
}

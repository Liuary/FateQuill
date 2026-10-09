import { useEffect, useState } from "react";
import type { Chapter } from "@/domain/models/chapter";
import { repositories } from "@/ipc/repositories";

/** 加载指定章节（含 content HTML）；chapterId 变化即重新拉取 */
export function useChapter(chapterId: number | null) {
  // 仅在异步回调中 setState（避免 effect 内同步 setState 触发级联渲染）
  const [loaded, setLoaded] = useState<{ id: number; chapter: Chapter } | null>(null);
  useEffect(() => {
    let alive = true;
    if (chapterId == null) return;
    repositories.chapter
      .get(chapterId)
      .then((c) => {
        if (alive) setLoaded({ id: chapterId, chapter: c });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [chapterId]);

  const loading = chapterId != null && loaded?.id !== chapterId;
  const chapter = loaded?.id === chapterId ? loaded.chapter : null;
  return { chapter, loading };
}

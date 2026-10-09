import { useCallback, useEffect, useState } from "react";
import type { Novel } from "@/domain/models/novel";
import { repositories } from "@/ipc/repositories";

/** 加载作品列表并（由上层）选中默认书（首个） */
export function useNovels() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    repositories.novel
      .list()
      .then((list) => {
        if (alive) {
          setNovels(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setNovels(await repositories.novel.list());
  }, []);

  const createNovel = useCallback(async (title: string, synopsis = "") => {
    const n = await repositories.novel.create({ title, synopsis });
    setNovels(await repositories.novel.list());
    return n;
  }, []);

  return { novels, loading, reload, createNovel };
}

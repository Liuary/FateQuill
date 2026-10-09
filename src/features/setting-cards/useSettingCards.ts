import { useCallback, useEffect, useState } from "react";
import type { SettingCard, SettingCardTier } from "@/domain/models/setting-card";
import { repositories } from "@/ipc/repositories";

export interface SettingCardInput {
  title: string;
  content: string;
  kind: string;
  /** 叙事分级（四级；与 `kind` 正交）——创建/编辑均贯通传递 */
  tier: SettingCardTier;
}

async function loadCards(novelId: number | null): Promise<SettingCard[]> {
  if (novelId == null) return [];
  return repositories.settingCard.listByNovel(novelId);
}

/** 某作品的设定卡列表 + 增删改（持久化经 stage-02 仓储 `repositories.settingCard`） */
export function useSettingCards(novelId: number | null) {
  const [cards, setCards] = useState<SettingCard[]>([]);

  const reload = useCallback(async () => {
    setCards(await loadCards(novelId));
  }, [novelId]);

  useEffect(() => {
    let alive = true;
    void loadCards(novelId).then(
      (c) => {
        if (alive) setCards(c);
      },
      () => {
        if (alive) setCards([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [novelId]);

  const create = useCallback(
    async (input: SettingCardInput) => {
      if (novelId == null) return;
      await repositories.settingCard.create({ novelId, ...input });
      setCards(await loadCards(novelId));
    },
    [novelId],
  );

  const update = useCallback(
    async (id: number, input: SettingCardInput) => {
      await repositories.settingCard.update(id, input);
      setCards(await loadCards(novelId));
    },
    [novelId],
  );

  const remove = useCallback(
    async (id: number) => {
      await repositories.settingCard.remove(id);
      setCards(await loadCards(novelId));
    },
    [novelId],
  );

  return { cards, reload, create, update, remove };
}

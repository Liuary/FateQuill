import { invokeCommand } from "@/ipc/client";
import {
  DEFAULT_SETTING_CARD_TIER,
  isSettingCardTier,
  type SettingCard,
  type SettingCardTier,
} from "@/domain/models/setting-card";
import type { SettingCardRepository } from "@/domain/repositories/setting-card-repository";

interface SettingCardRow {
  id: number;
  novel_id: number;
  title: string;
  content: string;
  kind: string;
  tier: string;
  created_at: string;
}

/** 行 → 领域模型（`tier` 值域兜底：未知值回退缺省 `short`） */
const toSettingCard = (r: SettingCardRow): SettingCard => ({
  id: r.id,
  novelId: r.novel_id,
  title: r.title,
  content: r.content,
  kind: r.kind,
  tier: isSettingCardTier(r.tier) ? r.tier : DEFAULT_SETTING_CARD_TIER,
  createdAt: r.created_at,
});

/** 可选分级参数（缺省不传，保持既有调用形态） */
const tierArgs = (tier?: SettingCardTier): Record<string, unknown> | undefined =>
  tier === undefined ? undefined : { tier };

/** 经 IPC 命令实现设定卡仓储（`tier` 过滤走 SQL 层；novelId 仍客户端过滤） */
export function createSettingCardRepository(): SettingCardRepository {
  return {
    async listByNovel(novelId, opts) {
      const rows = await invokeCommand<SettingCardRow[]>(
        "list_setting_cards",
        tierArgs(opts?.tier),
      );
      return rows.map(toSettingCard).filter((s) => s.novelId === novelId);
    },
    async get(id) {
      return toSettingCard(await invokeCommand<SettingCardRow>("get_setting_card", { id }));
    },
    async create(input) {
      return toSettingCard(
        await invokeCommand<SettingCardRow>("create_setting_card", {
          novelId: input.novelId,
          title: input.title,
          content: input.content,
          kind: input.kind,
          ...tierArgs(input.tier),
        }),
      );
    },
    async update(id, input) {
      return toSettingCard(
        await invokeCommand<SettingCardRow>("update_setting_card", {
          id,
          title: input.title,
          content: input.content,
          kind: input.kind,
          ...tierArgs(input.tier),
        }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_setting_card", { id });
    },
  };
}

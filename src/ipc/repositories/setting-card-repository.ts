import { invokeCommand } from "@/ipc/client";
import type { SettingCard } from "@/domain/models/setting-card";
import type { SettingCardRepository } from "@/domain/repositories/setting-card-repository";

interface SettingCardRow {
  id: number;
  novel_id: number;
  title: string;
  content: string;
  kind: string;
  created_at: string;
}

const toSettingCard = (r: SettingCardRow): SettingCard => ({
  id: r.id,
  novelId: r.novel_id,
  title: r.title,
  content: r.content,
  kind: r.kind,
  createdAt: r.created_at,
});

/** 经 IPC 命令实现设定卡仓储（命令无过滤参数，按父 id 客户端过滤） */
export function createSettingCardRepository(): SettingCardRepository {
  return {
    async listByNovel(novelId) {
      const rows = await invokeCommand<SettingCardRow[]>("list_setting_cards");
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
        }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_setting_card", { id });
    },
  };
}

import { invokeCommand } from "@/ipc/client";
import type { Novel } from "@/domain/models/novel";
import type { NovelRepository } from "@/domain/repositories/novel-repository";

interface NovelRow {
  id: number;
  title: string;
  synopsis: string;
  created_at: string;
  updated_at: string;
}

const toNovel = (r: NovelRow): Novel => ({
  id: r.id,
  title: r.title,
  synopsis: r.synopsis,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** 经 IPC 命令实现小说仓储 */
export function createNovelRepository(): NovelRepository {
  return {
    async list() {
      return (await invokeCommand<NovelRow[]>("list_novels")).map(toNovel);
    },
    async get(id) {
      return toNovel(await invokeCommand<NovelRow>("get_novel", { id }));
    },
    async create(input) {
      return toNovel(
        await invokeCommand<NovelRow>("create_novel", {
          title: input.title,
          synopsis: input.synopsis,
        }),
      );
    },
    async update(id, input) {
      return toNovel(
        await invokeCommand<NovelRow>("update_novel", {
          id,
          title: input.title,
          synopsis: input.synopsis,
        }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_novel", { id });
    },
  };
}

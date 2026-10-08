import { invokeCommand } from "@/ipc/client";
import type { Chapter } from "@/domain/models/chapter";
import { ChapterStatus, type ContentFormat } from "@/domain/values";
import type { ChapterRepository } from "@/domain/repositories/chapter-repository";

interface ChapterRow {
  id: number;
  volume_id: number;
  title: string;
  content: string;
  content_format: string;
  order_index: number;
  status: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

const toChapter = (r: ChapterRow): Chapter => ({
  id: r.id,
  volumeId: r.volume_id,
  title: r.title,
  content: r.content,
  contentFormat: r.content_format as ContentFormat,
  orderIndex: r.order_index,
  status: r.status as ChapterStatus,
  wordCount: r.word_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** 经 IPC 命令实现章节仓储（命令无过滤参数，按父 id 客户端过滤） */
export function createChapterRepository(): ChapterRepository {
  return {
    async listByVolume(volumeId) {
      const rows = await invokeCommand<ChapterRow[]>("list_chapters");
      return rows.map(toChapter).filter((c) => c.volumeId === volumeId);
    },
    async get(id) {
      return toChapter(await invokeCommand<ChapterRow>("get_chapter", { id }));
    },
    async create(input) {
      const created = toChapter(
        await invokeCommand<ChapterRow>("create_chapter", {
          volumeId: input.volumeId,
          title: input.title,
          content: input.content,
          contentFormat: input.contentFormat,
          orderIndex: input.orderIndex,
        }),
      );
      // create_chapter 命令不接受 status（默认 draft）；如需非默认状态则附加一次更新
      if (input.status && input.status !== ChapterStatus.Draft) {
        return toChapter(
          await invokeCommand<ChapterRow>("update_chapter", {
            id: created.id,
            title: input.title,
            content: input.content,
            contentFormat: input.contentFormat,
            status: input.status,
            orderIndex: input.orderIndex,
          }),
        );
      }
      return created;
    },
    async update(id, input) {
      return toChapter(
        await invokeCommand<ChapterRow>("update_chapter", {
          id,
          title: input.title,
          content: input.content,
          contentFormat: input.contentFormat,
          status: input.status,
          orderIndex: input.orderIndex,
        }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_chapter", { id });
    },
    async move(id, toVolumeId, toIndex) {
      await invokeCommand<void>("move_chapter", { chapterId: id, toVolumeId, toIndex });
    },
    async reorder(volumeId, orderedIds) {
      await invokeCommand<void>("reorder_chapters", { volumeId, orderedIds });
    },
  };
}

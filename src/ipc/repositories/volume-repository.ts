import { invokeCommand } from "@/ipc/client";
import type { Volume } from "@/domain/models/volume";
import type { VolumeRepository } from "@/domain/repositories/volume-repository";

interface VolumeRow {
  id: number;
  novel_id: number;
  title: string;
  order_index: number;
}

const toVolume = (r: VolumeRow): Volume => ({
  id: r.id,
  novelId: r.novel_id,
  title: r.title,
  orderIndex: r.order_index,
});

/** 经 IPC 命令实现卷仓储（命令无过滤参数，按父 id 客户端过滤） */
export function createVolumeRepository(): VolumeRepository {
  return {
    async listByNovel(novelId) {
      const rows = await invokeCommand<VolumeRow[]>("list_volumes");
      return rows.map(toVolume).filter((v) => v.novelId === novelId);
    },
    async get(id) {
      return toVolume(await invokeCommand<VolumeRow>("get_volume", { id }));
    },
    async create(input) {
      return toVolume(
        await invokeCommand<VolumeRow>("create_volume", {
          novelId: input.novelId,
          title: input.title,
          orderIndex: input.orderIndex,
        }),
      );
    },
    async update(id, input) {
      // 仅改标题：先读取当前 order_index 以保持不变（排序由 T5 的 reorder 命令负责）
      const current = await invokeCommand<VolumeRow>("get_volume", { id });
      return toVolume(
        await invokeCommand<VolumeRow>("update_volume", {
          id,
          title: input.title,
          orderIndex: current.order_index,
        }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_volume", { id });
    },
  };
}

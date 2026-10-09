import { invokeCommand } from "@/ipc/client";
import type { Material, MaterialSourceType, MaterialStatus } from "@/domain/models/material";
import type { MaterialRepository } from "@/domain/repositories/material-repository";

/** 后端行（snake_case）；`position_json` 为上下文 JSON 文本 */
interface MaterialRow {
  id: number;
  source_type: string;
  source_model: string;
  excerpt: string;
  position_json: string;
  reason: string;
  label: string;
  chapter_id: number | null;
  status: string;
  created_at: string;
}

/** `position_json` → `{ contextBefore?, contextAfter? }`；非法/空归一为 `{}` */
function parsePosition(raw: string): { contextBefore?: string; contextAfter?: string } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const source = parsed as { contextBefore?: unknown; contextAfter?: unknown };
    const position: { contextBefore?: string; contextAfter?: string } = {};
    if (typeof source.contextBefore === "string") {
      position.contextBefore = source.contextBefore;
    }
    if (typeof source.contextAfter === "string") {
      position.contextAfter = source.contextAfter;
    }
    return position;
  } catch {
    return {}; // 数据损坏：不阻断列表
  }
}

const toMaterial = (row: MaterialRow): Material => ({
  id: row.id,
  sourceType: row.source_type as MaterialSourceType,
  sourceModel: row.source_model,
  excerpt: row.excerpt,
  position: parsePosition(row.position_json),
  reason: row.reason,
  label: row.label,
  chapterId: row.chapter_id,
  status: row.status as MaterialStatus,
  createdAt: row.created_at,
});

/** 基于 IPC 命令实现的素材仓储（`position_json` ↔ `position`；`chapter_id` nil ↔ null） */
export function createMaterialRepository(): MaterialRepository {
  return {
    async save(input) {
      const position = input.position ?? {};
      return toMaterial(
        await invokeCommand<MaterialRow>("save_material", {
          sourceType: input.sourceType,
          sourceModel: input.sourceModel,
          excerpt: input.excerpt,
          positionJson: JSON.stringify(position),
          reason: input.reason,
          label: input.label,
          chapterId: input.chapterId,
          status: input.status,
        }),
      );
    },
    async list(filter) {
      const rows = await invokeCommand<MaterialRow[]>("list_materials", {
        status: filter?.status,
        sourceType: filter?.sourceType,
        query: filter?.query,
      });
      return rows.map(toMaterial);
    },
    async remove(id) {
      await invokeCommand<void>("delete_material", { id });
    },
  };
}

import { invokeCommand } from "@/ipc/client";
import type { SkillEntry, SkillExample } from "@/domain/models/skill-entry";
import type { SkillEntryRepository } from "@/domain/repositories/skill-entry-repository";

/** 后端行（snake_case）；`examples_json`/`source_material_ids_json` 为 JSON 文本 */
interface SkillEntryRow {
  id: number;
  version: string;
  title: string;
  rule: string;
  examples_json: string;
  source_material_ids_json: string;
  created_at: string;
}

/** `examples_json` → 示例数组；非法归一为空数组 */
function parseExamples(raw: string): SkillExample[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (item): item is { bad?: unknown; good?: unknown } =>
          typeof item === "object" && item !== null,
      )
      .map((item) => ({
        bad: String((item as { bad?: unknown }).bad ?? ""),
        good: String((item as { good?: unknown }).good ?? ""),
      }));
  } catch {
    return [];
  }
}

/** `source_material_ids_json` → id 数组；非法归一为空数组 */
function parseIds(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

const toSkillEntry = (row: SkillEntryRow): SkillEntry => ({
  id: row.id,
  version: row.version,
  title: row.title,
  rule: row.rule,
  examples: parseExamples(row.examples_json),
  sourceMaterialIds: parseIds(row.source_material_ids_json),
  createdAt: row.created_at,
});

/** 基于 IPC 命令实现的 skill 仓储（JSON 文本 ↔ 字段；来源素材以 id 引用） */
export function createSkillEntryRepository(): SkillEntryRepository {
  return {
    async save(input) {
      return toSkillEntry(
        await invokeCommand<SkillEntryRow>("save_skill_entry", {
          version: input.version,
          title: input.title,
          rule: input.rule,
          examples: input.examples ?? [],
          sourceMaterialIds: input.sourceMaterialIds,
        }),
      );
    },
    async update(id, input) {
      return toSkillEntry(
        await invokeCommand<SkillEntryRow>("update_skill_entry", {
          id,
          version: input.version,
          title: input.title,
          rule: input.rule,
          examples: input.examples ?? [],
          sourceMaterialIds: input.sourceMaterialIds,
        }),
      );
    },
    async list() {
      const rows = await invokeCommand<SkillEntryRow[]>("list_skill_entries");
      return rows.map(toSkillEntry);
    },
    async remove(id) {
      await invokeCommand<void>("delete_skill_entry", { id });
    },
  };
}

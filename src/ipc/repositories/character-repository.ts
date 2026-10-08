import { invokeCommand } from "@/ipc/client";
import type { Character } from "@/domain/models/character";
import type { CharacterRepository } from "@/domain/repositories/character-repository";

interface CharacterRow {
  id: number;
  novel_id: number;
  name: string;
  profile: string;
}

/** 行内 profile（JSON 字符串）→ 领域对象 */
const parseProfile = (p: string): Record<string, unknown> => {
  try {
    const v: unknown = JSON.parse(p);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const toCharacter = (r: CharacterRow): Character => ({
  id: r.id,
  novelId: r.novel_id,
  name: r.name,
  profile: parseProfile(r.profile),
});

/** 经 IPC 命令实现角色仓储（命令无过滤参数，按父 id 客户端过滤） */
export function createCharacterRepository(): CharacterRepository {
  return {
    async listByNovel(novelId) {
      const rows = await invokeCommand<CharacterRow[]>("list_characters");
      return rows.map(toCharacter).filter((c) => c.novelId === novelId);
    },
    async get(id) {
      return toCharacter(await invokeCommand<CharacterRow>("get_character", { id }));
    },
    async create(input) {
      return toCharacter(
        await invokeCommand<CharacterRow>("create_character", {
          novelId: input.novelId,
          name: input.name,
          profile: JSON.stringify(input.profile),
        }),
      );
    },
    async update(id, input) {
      return toCharacter(
        await invokeCommand<CharacterRow>("update_character", {
          id,
          name: input.name,
          profile: JSON.stringify(input.profile),
        }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_character", { id });
    },
  };
}

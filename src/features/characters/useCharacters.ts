/**
 * 角色 CRUD 编排（stage-10 T4）
 *
 * 职责：经既有 `character` 仓储（`list_characters` / `create_character` / `update_character` /
 * `delete_character`，**无 IPC 增量**）做角色增删改查；加载后把 `profile` JSON **归一**为契约字段。
 */

import { useCallback, useEffect, useState } from "react";
import type { Character } from "@/domain/models/character";
import { normalizeProfile, toProfileRecord } from "@/orchestration/dialogue/profile";
import type { DialogueProfile } from "@/orchestration/dialogue/types";
import { repositories } from "@/ipc/repositories";

/** 角色 + 归一后的 `profile` */
export type CharacterWithProfile = Omit<Character, "profile"> & { profile: DialogueProfile };

/** 角色写入输入 */
export interface CharacterInput {
  name: string;
  profile: DialogueProfile;
}

/** 加载并归一角色列表 */
async function loadCharacters(novelId: number): Promise<CharacterWithProfile[]> {
  const rows = await repositories.character.listByNovel(novelId);
  return rows.map((row) => ({ ...row, profile: normalizeProfile(row.profile) }));
}

/** 角色 CRUD 编排 */
export function useCharacters(novelId: number | null) {
  const [characters, setCharacters] = useState<CharacterWithProfile[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const reload = useCallback(async () => {
    if (novelId == null) {
      setCharacters([]);
      setState("ready");
      return;
    }
    setState("loading");
    try {
      setCharacters(await loadCharacters(novelId));
      setState("ready");
    } catch {
      // 读取失败（IPC 未就绪）：错误态，由 UI 提示
      setState("error");
    }
  }, [novelId]);

  useEffect(() => {
    let alive = true;
    if (novelId == null) {
      return; // 无作品：由返回值派生为空列表（不在 effect 内直接 setState）
    }
    void loadCharacters(novelId).then(
      (result) => {
        if (alive) {
          setCharacters(result);
          setState("ready");
        }
      },
      () => {
        if (alive) {
          setState("error");
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [novelId]);

  /** 新建角色（`profile` 归一后落库） */
  const create = useCallback(
    async (input: CharacterInput) => {
      if (novelId == null) {
        return false;
      }
      await repositories.character.create({
        novelId,
        name: input.name,
        profile: toProfileRecord(normalizeProfile(input.profile)),
      });
      await reload();
      return true;
    },
    [novelId, reload],
  );

  /** 更新角色 */
  const update = useCallback(
    async (id: number, input: CharacterInput) => {
      await repositories.character.update(id, {
        name: input.name,
        profile: toProfileRecord(normalizeProfile(input.profile)),
      });
      await reload();
      return true;
    },
    [reload],
  );

  /** 删除角色 */
  const remove = useCallback(
    async (id: number) => {
      await repositories.character.remove(id);
      await reload();
      return true;
    },
    [reload],
  );

  // 无作品（novelId=null）→ 派生为空列表 / ready（避免 effect 内 setState）
  return {
    characters: novelId == null ? [] : characters,
    state: novelId == null ? ("ready" as const) : state,
    reload,
    create,
    update,
    remove,
  };
}

/**
 * skill 库编排（stage-07 T5）
 *
 * 职责：加载 skill 列表与「可选素材」（`status=confirmed`）；提供**归纳**（选素材 + 填 `rule`，
 * **人工参与**，非自动归纳）、更新（版本管理）、删除。
 * 加载接口 `entries` / `reload()` 供后续 op（生成链路注入）复用。
 */

import { useCallback, useEffect, useState } from "react";
import type { Material } from "@/domain/models/material";
import type { SkillEntry, SkillExample } from "@/domain/models/skill-entry";
import { repositories } from "@/ipc/repositories";
import type { SkillEntryInput } from "@/domain/repositories/skill-entry-repository";

/** 解析 `bad => good` 逐行文本为示例数组（空行忽略；缺 `=>` 时 good 为空） */
export function parseExamples(text: string): SkillExample[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [bad, good] = line.split("=>").map((part) => part.trim());
      return { bad: bad ?? "", good: good ?? "" };
    });
}

/** 首屏加载：skill 列表 + 可选素材（confirmed） */
async function loadAll(): Promise<{ entries: SkillEntry[]; materials: Material[] }> {
  const [entries, materials] = await Promise.all([
    repositories.skillEntry.list(),
    repositories.material.list({ status: "confirmed" }),
  ]);
  return { entries, materials };
}

/** skill 库状态与操作 */
export function useSkillLibrary() {
  const [entries, setEntries] = useState<SkillEntry[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setState("loading");
    try {
      const result = await loadAll();
      setEntries(result.entries);
      setMaterials(result.materials);
      setState("ready");
    } catch {
      // 读取失败（IPC 未就绪）：错误态，由 UI 提示
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void loadAll().then(
      (result) => {
        if (alive) {
          setEntries(result.entries);
          setMaterials(result.materials);
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
  }, []);

  /** 归纳入库（人工参与）；失败（如来源素材无效）置 actionError */
  const save = useCallback(
    async (input: SkillEntryInput) => {
      setActionError(null);
      try {
        await repositories.skillEntry.save(input);
        await reload();
        return true;
      } catch {
        setActionError("save-failed");
        return false;
      }
    },
    [reload],
  );

  /** 更新（版本管理） */
  const update = useCallback(
    async (id: number, input: SkillEntryInput) => {
      setActionError(null);
      try {
        await repositories.skillEntry.update(id, input);
        await reload();
        return true;
      } catch {
        setActionError("update-failed");
        return false;
      }
    },
    [reload],
  );

  /** 删除 */
  const remove = useCallback(
    async (id: number) => {
      setActionError(null);
      try {
        await repositories.skillEntry.remove(id);
        await reload();
        return true;
      } catch {
        setActionError("delete-failed");
        return false;
      }
    },
    [reload],
  );

  return { entries, materials, state, actionError, reload, save, update, remove };
}

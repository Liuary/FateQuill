/**
 * 素材库编排（stage-07 BUG-001 修复）
 *
 * 职责：浏览/检索已入库素材（status / sourceType / 关键字 → `material.list`，复用 `list_materials` 命令）、
 * 删除（`material.remove`，含 REV-012 引用防护：被 skill 引用则**拒绝并特异提示**）。
 * **不改 Rust / 迁移 / IPC**（复用既有仓储与命令）。
 */

import { useCallback, useEffect, useState } from "react";
import type { Material, MaterialSourceType, MaterialStatus } from "@/domain/models/material";
import { IpcError, IpcErrorCode } from "@/ipc/errors";
import { repositories } from "@/ipc/repositories";

export interface MaterialFilter {
  status?: MaterialStatus;
  sourceType?: MaterialSourceType;
  query?: string;
}

/** 加载素材（供首屏与显式刷新复用） */
async function loadMaterials(filter: MaterialFilter): Promise<Material[]> {
  return repositories.material.list(filter);
}

/** 素材库状态与操作 */
export function useMaterialLibrary() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MaterialFilter>({});

  // 检索条件变化即重新加载（首屏 + 过滤）
  useEffect(() => {
    let alive = true;
    void loadMaterials(filter).then(
      (rows) => {
        if (alive) {
          setMaterials(rows);
          setState("ready");
        }
      },
      () => {
        // 读取失败（IPC 未就绪）：错误态，由 UI 提示
        if (alive) {
          setState("error");
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [filter]);

  /** 显式重新加载（删除后刷新当前检索结果） */
  const reload = useCallback(async () => {
    setState("loading");
    try {
      setMaterials(await loadMaterials(filter));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [filter]);

  /** 删除素材；被 skill 引用（FK_VIOLATION，REV-012）→ `delete-referenced`，其余 → `delete-failed` */
  const remove = useCallback(
    async (id: number) => {
      setActionError(null);
      try {
        await repositories.material.remove(id);
        await reload();
        return true;
      } catch (error) {
        setActionError(
          error instanceof IpcError && error.code === IpcErrorCode.FkViolation
            ? "delete-referenced"
            : "delete-failed",
        );
        return false;
      }
    },
    [reload],
  );

  return { materials, state, actionError, filter, setFilter, reload, remove };
}

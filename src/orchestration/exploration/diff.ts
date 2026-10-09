/**
 * 跨分支差异计算（stage-08 T2，纯函数）
 *
 * 职责：以 `keyTurns` 的**精确集合差**（**不做模糊对齐**，与 stage-07 交叉判断哲学一致）
 * 计算每个分支的**独有**与**共现**关键转折，供分支对比视图做差异标注。
 */

import type { ExplorationBranch } from "./types";

export interface BranchDiff {
  branchId: string;
  /** 仅该分支出现的 keyTurns */
  uniqueKeyTurns: string[];
  /** 多分支共现的 keyTurns */
  sharedKeyTurns: string[];
}

/** 跨分支差异：`uniqueKeyTurns` = 仅该分支出现；`sharedKeyTurns` = 多分支共现（同分支重复只计一次） */
export function diffBranches(branches: ExplorationBranch[]): BranchDiff[] {
  // keyTurn → 出现它的分支 id 集合
  const owners = new Map<string, Set<string>>();
  for (const branch of branches) {
    for (const turn of new Set(branch.card?.keyTurns ?? [])) {
      const ids = owners.get(turn) ?? new Set<string>();
      ids.add(branch.id);
      owners.set(turn, ids);
    }
  }

  return branches.map((branch) => {
    const turns = [...new Set(branch.card?.keyTurns ?? [])];
    return {
      branchId: branch.id,
      uniqueKeyTurns: turns.filter((turn) => (owners.get(turn)?.size ?? 0) === 1),
      sharedKeyTurns: turns.filter((turn) => (owners.get(turn)?.size ?? 0) > 1),
    };
  });
}

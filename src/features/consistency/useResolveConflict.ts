/**
 * 冲突处置编排（stage-11 T4）
 *
 * 四动作（IPC `resolve_conflict_record` 的 `action` 全值域）：
 * - `change_tier`：`settingCard.update` **改分级** → 落库留痕（`resolved`）；
 * - `edit`：**跳转设定卡面板 + `evidence` verbatim 定位**（`indexOf` 命中区间；**缺失回退卡首**）→ 落库留痕（`resolved`）；
 * - `false_positive`：**标记误报**（反馈闭环保留）→ 落库（`ignored`，`action` 区分）；
 * - `ignore`：**忽略**（留痕）→ 落库（`ignored`）。
 */

import { useCallback, useState } from "react";
import type { ConflictDispositionAction } from "@/domain/models/conflict-record";
import type { ConflictRecord } from "@/domain/models/conflict-record";
import type { SettingCardTier } from "@/domain/models/setting-card";
import { repositories } from "@/ipc/repositories";
import { useConsistencyFocusStore } from "@/store/consistencyStore";

/** 命中区间（`length === 0` 表示**未命中** → 已回退卡首） */
export interface EvidenceLocation {
  index: number;
  length: number;
}

/** 候选检索串：优先 `「…」` 引文（L1 证据形如 `实体：「句A」 ｜「句B」`），其次分段，最后整段 */
function needlesOf(evidence: string): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !out.includes(trimmed)) {
      out.push(trimmed);
    }
  };
  for (const match of evidence.matchAll(/「([^」]+)」/g)) {
    push(match[1]);
  }
  for (const part of evidence.split(/[｜|]/)) {
    push(part.replace(/[「」]/g, " "));
  }
  push(evidence);
  return out;
}

/**
 * 按 `evidence` 在**卡内容**中做 **verbatim 定位**：命中 → 返回选中区间；
 * 全部候选均未命中 → **回退卡首**（`{index:0,length:0}`）。
 */
export function locateEvidence(content: string, evidence: string): EvidenceLocation {
  for (const needle of needlesOf(evidence)) {
    const index = content.indexOf(needle);
    if (index >= 0) {
      return { index, length: needle.length };
    }
  }
  return { index: 0, length: 0 };
}

export interface ResolveConflictOptions {
  /** 处置完成后回调（如刷新列表） */
  onResolved?: () => void | Promise<void>;
}

/** 冲突处置编排 */
export function useResolveConflict(opts: ResolveConflictOptions = {}) {
  const [busyAction, setBusyAction] = useState<ConflictDispositionAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 执行处置（失败不抛穿：置 `error` 并返回 `false`） */
  const resolve = useCallback(
    async (
      conflict: ConflictRecord,
      action: ConflictDispositionAction,
      options: { tier?: SettingCardTier } = {},
    ): Promise<boolean> => {
      setBusyAction(action);
      setError(null);
      try {
        if (action === "change_tier" || action === "edit") {
          const card = await repositories.settingCard.get(conflict.aId);
          if (action === "change_tier") {
            // 改分级：保持其余字段不变；`tier` 由 UI 指定（缺省保守 `short`）
            await repositories.settingCard.update(card.id, {
              title: card.title,
              content: card.content,
              kind: card.kind,
              tier: options.tier ?? "short",
            });
          } else {
            // 跳转定位：请求切到设定卡面板并选中 evidence 命中片段（未命中 → 卡首）
            useConsistencyFocusStore.getState().requestFocus({
              cardId: card.id,
              ...locateEvidence(card.content, conflict.evidence),
            });
          }
        }
        // 处置留痕（change_tier/edit → resolved；false_positive/ignore → ignored）
        await repositories.conflictRecord.resolve(conflict.id, action);
        await opts.onResolved?.();
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [opts],
  );

  return { resolve, busyAction, error };
}

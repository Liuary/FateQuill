/**
 * 冲突记录（stage-11 T4）
 *
 * 冲突记录**落库**（`conflict_record`，跨会话可查）；`type` / `severity` 词表与
 * `@/orchestration/consistency/types` **单一来源**（type-only 引用，避免双份枚举漂移）。
 */

import type { ConflictSeverity, ConflictType } from "@/orchestration/consistency/types";

/** 处置动作（与 Rust `VALID_ACTIONS` 一致；`false_positive` 与 `ignore` 均置 `ignored`，仅 `action` 留痕不同） */
export const CONFLICT_DISPOSITION_ACTIONS = [
  "change_tier",
  "edit",
  "false_positive",
  "ignore",
] as const;

/** 处置动作值 */
export type ConflictDispositionAction = (typeof CONFLICT_DISPOSITION_ACTIONS)[number];

/** 冲突记录状态（与迁移 v5 的 `CHECK` 一致） */
export type ConflictRecordStatus = "open" | "resolved" | "ignored";

/** 冲突记录（一行 = 一对设定卡的冲突 + 处置留痕） */
export interface ConflictRecord {
  id: number;
  novelId: number;
  /** 冲突设定卡 A（id 较小者） */
  aId: number;
  /** 冲突设定卡 B（id 较大者） */
  bId: number;
  type: ConflictType;
  evidence: string;
  severity: ConflictSeverity;
  status: ConflictRecordStatus;
  /** 处置动作（未处置为空串） */
  action: string;
  createdAt: string;
  /** 处置时间（未处置为 `null`） */
  resolvedAt: string | null;
}

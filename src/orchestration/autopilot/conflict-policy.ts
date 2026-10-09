/**
 * 无人值守**冲突策略**（stage-12 T4）
 *
 * 解决「无人值守」×「用户终裁决」矛盾：**纯函数**给出两路径决策，**两条路径均留痕**（可审计）。
 *
 * - **默认**（`pauseOnConflict: true`）→ `pause`：**暂停 + 通知**，冲突以 `status: "open"` 落库（**留痕**），
 *   由用户裁决（可经 op-004 断点**续跑**）；
 * - **用户显式授权**（`pauseOnConflict: false`）→ `ignore-continue`：冲突以 `status: "ignored"` +
 *   `action: "ignore"` 落库（**留痕**）后**继续**生产——**非默认**行为，不违背「建议非结论」。
 */

import type {
  ConflictReport,
  ConflictSeverity,
  ConflictType,
} from "@/orchestration/consistency/types";

/** 冲突策略决策（含落库记录草案） */
export interface ConflictPolicyDecision {
  /** `pause`：暂停 + 通知；`ignore-continue`：授权后自动忽略并继续 */
  action: "pause" | "ignore-continue";
  /** 落库草案（经 `save_conflict_record` 写入；`ignore-continue` 另经 `resolve_conflict_record` 标记） */
  record: {
    aId: number;
    bId: number;
    type: ConflictType;
    evidence: string;
    severity: ConflictSeverity;
    /** `open`（待用户裁决，暂停路径） / `ignored`（已授权忽略，继续路径） */
    status: "open" | "ignored";
    /** 处置动作留痕：暂停路径为空串；忽略路径为 `"ignore"` */
    action: string;
  };
}

/**
 * 决策：`pauseOnConflict` 为 `true`（**默认**）→ 暂停 + 留痕 `open`；
 * `false`（**用户显式授权**）→ 自动 `ignored` + 留痕 `action: "ignore"` 并继续。
 */
export function decideConflictPolicy(input: {
  conflict: Pick<ConflictReport, "aId" | "bId" | "type" | "evidence" | "severity">;
  pauseOnConflict: boolean;
}): ConflictPolicyDecision {
  const base = {
    aId: input.conflict.aId,
    bId: input.conflict.bId,
    type: input.conflict.type,
    evidence: input.conflict.evidence,
    severity: input.conflict.severity,
  };

  if (input.pauseOnConflict) {
    return { action: "pause", record: { ...base, status: "open", action: "" } };
  }
  return { action: "ignore-continue", record: { ...base, status: "ignored", action: "ignore" } };
}

/** 冲突去重键（`(aId,bId,type)`）：同一冲突不重复落库 */
export function conflictKey(conflict: { aId: number; bId: number; type: string }): string {
  return `${conflict.aId}|${conflict.bId}|${conflict.type}`;
}

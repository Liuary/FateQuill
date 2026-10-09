/**
 * 多声部成本预估（stage-10 T6）
 *
 * 由**参与角色集**（可「仅主要角色」过滤）+ 旁白计算**启动前**成本预估
 * （复用 `estimateDialogueCost`；口径见其 `note`）。
 */

import { useMemo } from "react";
import {
  estimateDialogueCost,
  selectParticipants,
  type ParticipantCandidate,
} from "@/orchestration/dialogue/cost";
import type { CostEstimate } from "@/orchestration/exploration/cost";

export interface DialogueCostState<T> {
  /** 实际参与的角色（已按 `majorOnly` 过滤） */
  participants: T[];
  /** 参与角色数（含旁白） */
  participantCount: number;
  estimate: CostEstimate;
}

/** 多声部成本预估（启动前显示） */
export function useDialogueCost<T extends ParticipantCandidate>(
  characters: T[],
  opts: { majorOnly: boolean; includeNarrator?: boolean },
): DialogueCostState<T> {
  const includeNarrator = opts.includeNarrator ?? true;
  return useMemo(() => {
    const participants = selectParticipants(characters, { majorOnly: opts.majorOnly });
    const participantCount = participants.length + (includeNarrator ? 1 : 0);
    return { participants, participantCount, estimate: estimateDialogueCost(participantCount) };
  }, [characters, opts.majorOnly, includeNarrator]);
}

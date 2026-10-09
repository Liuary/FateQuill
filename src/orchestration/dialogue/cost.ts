/**
 * 多声部成本预估与参与角色选取（stage-10 T6）
 *
 * **复用 stage-08 `estimateCost` 范式**（`src/orchestration/exploration/cost.ts`）：
 * 成本口径 = **参与角色数 ×（输出上限 + 输入估算）**（输入为估算口径，沿用 stage-08 声明）；
 * **启动前显示**。
 */

import {
  estimateCost,
  INPUT_TOKENS_PER_BRANCH_DEFAULT,
  OUTPUT_TOKEN_LIMIT_DEFAULT,
  type CostEstimate,
} from "@/orchestration/exploration/cost";
import { normalizeProfile } from "./profile";
import type { DialogueProfile } from "./types";

/** 多声部成本预估：**参与角色数 × 输出上限**（含输入侧估算） */
export function estimateDialogueCost(
  participantCount: number,
  opts?: { outputLimit?: number; inputTokensPerBranch?: number },
): CostEstimate {
  const outputLimit = opts?.outputLimit ?? OUTPUT_TOKEN_LIMIT_DEFAULT;
  const inputTokensPerBranch = opts?.inputTokensPerBranch ?? INPUT_TOKENS_PER_BRANCH_DEFAULT;
  const estimate = estimateCost(participantCount, { outputLimit, inputTokensPerBranch });
  return {
    tokens: estimate.tokens,
    note: `预估 = 参与角色数 ×（输出上限 ${outputLimit} + 输入估算 ${inputTokensPerBranch}）`,
  };
}

/** 参与角色候选（`profile` 可为原始 JSON 或已归一） */
export interface ParticipantCandidate {
  id?: number;
  name: string;
  profile?: DialogueProfile | Record<string, unknown>;
}

/** 选取参与角色：`majorOnly=true` → 仅 `profile.major === true`（经 `normalizeProfile` 归一判定） */
export function selectParticipants<T extends ParticipantCandidate>(
  characters: T[],
  opts?: { majorOnly?: boolean },
): T[] {
  if (!opts?.majorOnly) {
    return [...characters];
  }
  return characters.filter(
    (character) => normalizeProfile(character.profile as DialogueProfile).major === true,
  );
}

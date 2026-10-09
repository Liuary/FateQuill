/**
 * 走向卡解析与输出契约（stage-08 T1）
 *
 * 职责：走向卡 JSON 容错解析（复用 `@/orchestration/review/json` 的 `extractJson`，去围栏/夹取），
 * 以及作为 **system 段约束**的输出契约提示（走向意向走 user 段）。
 */

import { extractJson } from "@/orchestration/review/json";
import type { TurnCard } from "./types";

/** 走向卡输出契约（推演 system 段；JSON 结构 + 约束说明） */
export const TURN_CARD_SYSTEM_PROMPT = [
  "你是简体中文长篇小说推演助手。请依据既有设定与前文，推演「走向意向」下的一种可能发展。",
  "要求：",
  "1. 只输出如下 JSON，不要输出解释文字或 Markdown 围栏之外的内容：",
  '{"summary":"<走向摘要>","keyTurns":["<关键转折1>","<关键转折2>"],"settingCardIds":[<涉及的设定卡 id>]}',
  "2. `summary` 为 1–2 句走向概述；",
  "3. `keyTurns` 为关键转折点列表（可为空数组）；",
  "4. `settingCardIds` 只填**前文已给出的设定卡 id**（未涉及则为空数组）；",
  "5. 保持与既有设定、前文语气一致，不引入冲突设定。",
].join("\n");

/** 解析走向卡 JSON；非法（非对象/缺 summary/非合法 JSON）抛错（由 runner 逐分支容错） */
export function parseTurnCard(raw: string): TurnCard {
  const data: unknown = JSON.parse(extractJson(raw));
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("invalid turn card payload");
  }
  const source = data as { summary?: unknown; keyTurns?: unknown; settingCardIds?: unknown };
  if (typeof source.summary !== "string" || source.summary.trim().length === 0) {
    throw new Error("invalid turn card summary");
  }
  const keyTurns = Array.isArray(source.keyTurns)
    ? source.keyTurns.map((turn) => String(turn)).filter((turn) => turn.trim().length > 0)
    : [];
  const settingCardIds = Array.isArray(source.settingCardIds)
    ? source.settingCardIds.filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      )
    : [];
  return { summary: source.summary.trim(), keyTurns, settingCardIds };
}

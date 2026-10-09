/**
 * persona 字段归一（stage-10 T4）
 *
 * 从 `CHARACTER_PROFILE_KEYS`（**单一来源**）出发，归一并校验 `character.profile` JSON：
 * - 文本字段缺失 / 非文本 → **空串**；
 * - `major` → **boolean**（非布尔值 → `false`）；
 * - **异常安全**（`null` / 非对象 → 全空 profile）。
 *
 * 供 `buildCharacterAgentPrompt`（op-002）与 `CharacterForm`（本 op）**共用同一字段来源**。
 */

import {
  CHARACTER_PROFILE_KEYS,
  type CharacterProfileTextField,
  type DialogueProfile,
} from "./types";

/** persona 文本字段（排除布尔字段 `major`） */
export const PROFILE_TEXT_KEYS = CHARACTER_PROFILE_KEYS.filter(
  (key) => key !== "major",
) as CharacterProfileTextField[];

/** 归一 `profile`（异常安全：`null` / 非对象 → 全空） */
export function normalizeProfile(
  raw: Record<string, unknown> | DialogueProfile | null | undefined,
): DialogueProfile {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const profile: DialogueProfile = {};
  for (const key of PROFILE_TEXT_KEYS) {
    const value = source[key];
    profile[key] = typeof value === "string" ? value.trim() : "";
  }
  profile.major = source.major === true;
  return profile;
}

/** 归一后的 profile → 落库 JSON 记录（**仅含契约字段**） */
export function toProfileRecord(profile: DialogueProfile): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const key of PROFILE_TEXT_KEYS) {
    record[key] = profile[key] ?? "";
  }
  record.major = profile.major === true;
  return record;
}

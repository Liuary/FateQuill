/**
 * 上下文隔离（防串味）装配（stage-10 T5，**本阶段核心**）
 *
 * **白名单显式化**——每个角色 Agent 的输入只含：
 * 1. **本人 persona（完整）**；
 * 2. **公共场景**（设定卡 + 前章末尾/当前章 + 用户场景指令）；
 * 3. **公共对话历史**（已定稿台词/旁白）；
 * 4. 他人的**公开身份一行摘要**（仅 `identity`，缺省回退角色名）。
 *
 * **不共享**：他人 persona 细节（`personality`/`speechStyle`/`goal`/`extra`）、内心独白、秘密。
 * 串味判据（可判定）：角色 A 的秘密 `X` **不出现在角色 B 的 prompt**（装配层）。
 */

import { buildCharacterAgentPrompt } from "./persona";
import { normalizeProfile } from "./profile";
import type { DialogueProfile } from "./types";

/** 公共对话历史条目（已定稿的第三方台词 / 旁白） */
export interface PublicHistoryEntry {
  /** 说话人（旁白可缺省） */
  speaker?: string;
  content: string;
}

export interface PublicContextInput {
  /** 设定卡（公共场景设定） */
  settingCards?: { title: string; content: string }[];
  /** 前章末尾 / 当前章正文（公共） */
  previousChapterTail?: string;
  /** 用户场景指令（公共） */
  sceneInstruction?: string;
  /** 公共对话历史（已定稿） */
  history?: PublicHistoryEntry[];
}

/** 公共场景上下文（**不含任何他人 persona**） */
export function buildPublicContext(input: PublicContextInput): string {
  const blocks: string[] = [];
  if (input.settingCards && input.settingCards.length > 0) {
    blocks.push(
      `【设定】\n${input.settingCards.map((card) => `${card.title}: ${card.content}`).join("\n")}`,
    );
  }
  const tail = input.previousChapterTail?.trim();
  if (tail) {
    blocks.push(`【前文】\n${tail}`);
  }
  const scene = input.sceneInstruction?.trim();
  if (scene) {
    blocks.push(`【场景指令】\n${scene}`);
  }
  if (input.history && input.history.length > 0) {
    blocks.push(
      `【已定稿对话】\n${input.history
        .map((entry) => (entry.speaker ? `${entry.speaker}：${entry.content}` : entry.content))
        .join("\n")}`,
    );
  }
  return blocks.join("\n\n");
}

/**
 * 他人**公开身份一行摘要**：仅取 `identity`（私有字段一律不取）；
 * 缺省 → 回退**角色名**。
 */
export function buildPublicSummary(
  profile: DialogueProfile | undefined,
  fallbackName = "",
): string {
  const identity = normalizeProfile(profile).identity?.trim();
  return identity ? identity : fallbackName;
}

/** 在场其他角色（**仅用其 `identity` 生成摘要**） */
export interface OtherCharacter {
  id?: number;
  name: string;
  profile?: DialogueProfile;
}

export interface CharacterAgentInput {
  /** 本人 persona（**完整注入**） */
  selfProfile: DialogueProfile;
  /** 公共上下文（由 `buildPublicContext` 产出） */
  publicContext: string;
  /** 在场其他角色（仅公开身份摘要） */
  others?: OtherCharacter[];
}

/**
 * 角色 Agent 输入（**白名单装配**）：
 * - `system` = 本人 persona 完整（经 `buildCharacterAgentPrompt`）；
 * - `user` = 公共上下文 + 他人公开身份摘要行。
 *
 * **不含任何他人 persona 细节**（防串味）。
 */
export function buildCharacterAgentInput(input: CharacterAgentInput): {
  system: string;
  user: string;
} {
  const prompt = buildCharacterAgentPrompt({
    profile: input.selfProfile,
    publicContext: input.publicContext,
  });

  const summaries = (input.others ?? []).map(
    (other) => `他人（公开身份）：${buildPublicSummary(other.profile, other.name)}`,
  );
  const user = [
    input.publicContext,
    summaries.length > 0 ? `【在场角色（仅公开身份）】\n${summaries.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system: prompt.system, user };
}

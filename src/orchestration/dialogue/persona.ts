/**
 * persona 装配（stage-10 T1）
 *
 * - `buildCharacterAgentPrompt`：**persona 完整注入** system 段（`identity/personality/speechStyle/goal/extra`，
 *   跳过空字段）；公共上下文入 **user 段**；
 * - `buildNarratorAgentPrompt`：叙述者 persona，**与角色 Agent 仅 system 差异**（同一装配链：user 段同为公共上下文）。
 */

import type { CharacterProfileTextField, DialogueProfile } from "./types";

/** persona 文本字段的展示标签 */
const PROFILE_LABELS: Record<CharacterProfileTextField, string> = {
  identity: "身份",
  personality: "性格",
  speechStyle: "说话风格",
  goal: "目标",
  extra: "补充",
};

/** 装配顺序（稳定输出，便于断言与复现） */
const TEXT_FIELDS: CharacterProfileTextField[] = [
  "identity",
  "personality",
  "speechStyle",
  "goal",
  "extra",
];

/** 读取 persona 字段（缺省 / 非文本 / 异常 → 空串） */
export function readProfileField(
  profile: DialogueProfile | undefined,
  key: CharacterProfileTextField,
): string {
  if (!profile) {
    return "";
  }
  const value = profile[key];
  return typeof value === "string" ? value.trim() : "";
}

/** 角色 Agent 提示（persona 完整注入 system；公共上下文入 user） */
export function buildCharacterAgentPrompt(input: {
  profile?: DialogueProfile;
  publicContext: string;
}): { system: string; user: string } {
  const personaLines: string[] = [];
  for (const key of TEXT_FIELDS) {
    const value = readProfileField(input.profile, key);
    if (value) {
      personaLines.push(`${PROFILE_LABELS[key]}：${value}`);
    }
  }

  const system = [
    "你正在扮演简体中文长篇小说中的一个角色，请以**该角色的视角与口吻**说话：第一人称，只输出该角色的台词或内心独白，不写旁白、不解释。",
    personaLines.length > 0
      ? `【角色设定】\n${personaLines.join("\n")}`
      : "【角色设定】（未提供，按上下文自然扮演）",
    "严格保持角色一致性：性格、说话风格与目标不得漂移。",
  ].join("\n\n");

  return { system, user: input.publicContext };
}

/** 旁白 Agent 提示（叙述者 persona；与角色 Agent **仅 system 差异**） */
export function buildNarratorAgentPrompt(input: { publicContext: string }): {
  system: string;
  user: string;
} {
  const system = [
    "你是简体中文长篇小说的叙述者，请以**第三人称叙述**推进场景：只输出叙述与描写，不代替角色说话。",
    "保持与既有设定、前文语气一致；克制、自然，避免套话与排比堆砌。",
  ].join("\n\n");

  return { system, user: input.publicContext };
}

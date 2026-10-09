/**
 * 角色 / 旁白 Agent 注册（stage-10 T1）
 *
 * 每个角色一个独立 `Agent`（persona 完整注入其 `systemPrompt`）；旁白 Agent 与角色 Agent
 * **仅 system 段差异**。复用 `Registry<Agent>` 的 `register/replace`，**可注册、可替换**（同 id 覆盖不抛错）。
 */

import type { Registry } from "@/orchestration/registry";
import type { Agent, ModelRef } from "@/orchestration/types";
import { buildCharacterAgentPrompt, buildNarratorAgentPrompt } from "./persona";
import type { DialogueAgentInput } from "./types";

/** 旁白 Agent 保留 id */
export const NARRATOR_AGENT_ID = "narrator";

/** 角色 Agent id 前缀 */
export const CHARACTER_AGENT_PREFIX = "character:";

/** 角色 Agent id（`character:{characterId}`） */
export function characterAgentId(characterId: string | number): string {
  return `${CHARACTER_AGENT_PREFIX}${characterId}`;
}

/** 注册（或**替换**）角色 Agent：persona 完整注入其 system 段 */
export function registerCharacterAgent(
  registry: Registry<Agent>,
  input: DialogueAgentInput & { id: string; name: string },
): Agent {
  const agent: Agent = {
    id: input.id,
    name: input.name,
    systemPrompt: buildCharacterAgentPrompt({
      profile: input.profile,
      publicContext: input.publicContext,
    }).system,
    modelRef: input.modelRef,
  };
  // 可替换：已存在则覆盖（不抛 duplicate id）
  if (registry.has(agent.id)) {
    registry.replace(agent);
  } else {
    registry.register(agent);
  }
  return agent;
}

/** 注册（或替换）旁白 Agent（叙述者 persona；与角色 Agent 仅 system 差异） */
export function registerNarratorAgent(
  registry: Registry<Agent>,
  input: { modelRef: ModelRef; publicContext: string },
): Agent {
  const agent: Agent = {
    id: NARRATOR_AGENT_ID,
    name: "旁白",
    systemPrompt: buildNarratorAgentPrompt({ publicContext: input.publicContext }).system,
    modelRef: input.modelRef,
  };
  if (registry.has(agent.id)) {
    registry.replace(agent);
  } else {
    registry.register(agent);
  }
  return agent;
}

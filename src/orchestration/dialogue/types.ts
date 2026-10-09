/**
 * 多声部对话契约（stage-10 T1）
 *
 * persona 契约：`character.profile` 为 **JSON**（**零迁移**），最小字段
 * `{ identity, personality, speechStyle, goal, extra, major? }`（自由文本；`major` 供「仅主要角色」过滤）。
 * 全字段**可选**，**缺失安全降级**。
 */

import type { ModelRef } from "@/orchestration/types";

/** 角色 persona 契约（`character.profile` JSON 的最小字段） */
export interface DialogueProfile {
  /** 身份（如「雾港守塔人」） */
  identity?: string;
  /** 性格 */
  personality?: string;
  /** 说话风格 */
  speechStyle?: string;
  /** 目标 / 动机 */
  goal?: string;
  /** 其它补充 */
  extra?: string;
  /** 是否主要角色（供「仅主要角色」过滤） */
  major?: boolean;
}

/** persona 字段名常量（T4 表单与装配**共用同一来源**） */
export const CHARACTER_PROFILE_KEYS = [
  "identity",
  "personality",
  "speechStyle",
  "goal",
  "extra",
  "major",
] as const;

/** persona 文本字段（`major` 为布尔，不属文本域） */
export type CharacterProfileTextField = Exclude<(typeof CHARACTER_PROFILE_KEYS)[number], "major">;

/**
 * 角色 Agent 装配输入（**单一来源**，REV-006）：persona + 公共上下文 + 模型引用。
 */
export interface DialogueAgentInput {
  profile: DialogueProfile;
  /** 公共上下文（设定卡/前文等；由 op-006 的 `buildPublicContext` 提供） */
  publicContext: string;
  modelRef: ModelRef;
}

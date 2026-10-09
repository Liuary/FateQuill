import { describe, expect, it } from "vitest";
import { createRegistries } from "@/orchestration/registry";
import type { ModelRef } from "@/orchestration/types";
import {
  NARRATOR_AGENT_ID,
  characterAgentId,
  registerCharacterAgent,
  registerNarratorAgent,
} from "./agents";
import { buildCharacterAgentPrompt, buildNarratorAgentPrompt, readProfileField } from "./persona";
import { CHARACTER_PROFILE_KEYS } from "./types";

const modelRef: ModelRef = { providerId: "openai-compatible", model: "m" };
const publicContext = "青灯引航，子夜前挂三盏。";

describe("DialogueProfile 契约（CHARACTER_PROFILE_KEYS）", () => {
  it("字段名常量单一来源（六个字段）", () => {
    expect([...CHARACTER_PROFILE_KEYS]).toEqual([
      "identity",
      "personality",
      "speechStyle",
      "goal",
      "extra",
      "major",
    ]);
  });

  it("readProfileField：缺省/非文本 → 空串（异常安全）", () => {
    expect(readProfileField(undefined, "identity")).toBe("");
    expect(readProfileField({}, "identity")).toBe("");
    expect(readProfileField({ identity: "  林砚  " }, "identity")).toBe("林砚");
    expect(readProfileField({ identity: 123 as unknown as string }, "identity")).toBe("");
  });
});

describe("buildCharacterAgentPrompt（persona 完整注入）", () => {
  it("system 含 persona 各要素（identity/personality/speechStyle/goal/extra）", () => {
    const { system } = buildCharacterAgentPrompt({
      profile: {
        identity: "侠客甲",
        personality: "沉默、护短",
        speechStyle: "冷峻寡言",
        goal: "找回断刃",
        extra: "左手使刀",
      },
      publicContext,
    });

    expect(system).toContain("侠客甲");
    expect(system).toContain("沉默、护短");
    expect(system).toContain("冷峻寡言");
    expect(system).toContain("找回断刃");
    expect(system).toContain("左手使刀");
    expect(system).toContain("身份：侠客甲");
    expect(system).toContain("说话风格：冷峻寡言");
  });

  it("空 / 缺失 profile → 不抛错，字段降级（占位说明）", () => {
    const empty = buildCharacterAgentPrompt({ profile: undefined, publicContext });
    expect(empty.system).toContain("（未提供，按上下文自然扮演）");
    expect(() => buildCharacterAgentPrompt({ profile: {}, publicContext })).not.toThrow();
  });

  it("user 段 = 公共上下文", () => {
    const { user } = buildCharacterAgentPrompt({ profile: { identity: "甲" }, publicContext });
    expect(user).toBe(publicContext);
  });
});

describe("buildNarratorAgentPrompt（旁白仅 system 差异）", () => {
  it("角色与旁白 system 不同；装配链一致（user 段同为公共上下文）", () => {
    const character = buildCharacterAgentPrompt({
      profile: { identity: "侠客甲", speechStyle: "冷峻寡言" },
      publicContext,
    });
    const narrator = buildNarratorAgentPrompt({ publicContext });

    expect(narrator.system).not.toBe(character.system);
    expect(narrator.system).toContain("叙述者"); // 旁白 personа
    expect(narrator.system).not.toContain("侠客甲"); // 不带角色 persona
    expect(narrator.user).toBe(character.user); // 同装配链：user = 公共上下文
    expect(narrator.user).toBe(publicContext);
  });
});

describe("角色 / 旁白 Agent 注册（可注册、可替换）", () => {
  it("注册角色 Agent：persona 注入 systemPrompt；旁白可并存", () => {
    const registries = createRegistries();
    const agent = registerCharacterAgent(registries.agents, {
      id: characterAgentId(1),
      name: "林砚",
      modelRef,
      profile: { identity: "侠客甲", speechStyle: "冷峻寡言" },
      publicContext,
    });

    expect(agent.id).toBe("character:1");
    expect(agent.systemPrompt).toContain("侠客甲");
    expect(agent.systemPrompt).toContain("冷峻寡言");
    expect(registries.agents.resolve("character:1")).toBe(agent);

    const narrator = registerNarratorAgent(registries.agents, { modelRef, publicContext });
    expect(narrator.id).toBe(NARRATOR_AGENT_ID);
    expect(registries.agents.list()).toHaveLength(2);
    expect(narrator.systemPrompt).not.toBe(agent.systemPrompt); // 仅 system 差异
  });

  it("同 id 二次注册 → replace 覆盖（不抛 duplicate），systemPrompt 反映最新 persona", () => {
    const registries = createRegistries();
    registerCharacterAgent(registries.agents, {
      id: characterAgentId(1),
      name: "林砚",
      modelRef,
      profile: { identity: "侠客甲", speechStyle: "冷峻寡言" },
      publicContext,
    });

    expect(() =>
      registerCharacterAgent(registries.agents, {
        id: characterAgentId(1),
        name: "林砚",
        modelRef,
        profile: { identity: "守塔人", speechStyle: "絮叨" },
        publicContext,
      }),
    ).not.toThrow();

    const updated = registries.agents.resolve("character:1");
    expect(updated.systemPrompt).toContain("守塔人");
    expect(updated.systemPrompt).toContain("絮叨");
    expect(updated.systemPrompt).not.toContain("侠客甲");
    expect(registries.agents.list()).toHaveLength(1); // 替换而非新增
  });

  it("旁白 Agent 亦可替换", () => {
    const registries = createRegistries();
    registerNarratorAgent(registries.agents, { modelRef, publicContext });
    expect(() =>
      registerNarratorAgent(registries.agents, { modelRef, publicContext: "新上下文" }),
    ).not.toThrow();
    expect(registries.agents.list()).toHaveLength(1);
  });
});

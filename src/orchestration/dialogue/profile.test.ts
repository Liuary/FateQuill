import { describe, expect, it } from "vitest";
import { buildCharacterAgentPrompt } from "./persona";
import { PROFILE_TEXT_KEYS, normalizeProfile, toProfileRecord } from "./profile";
import { CHARACTER_PROFILE_KEYS } from "./types";

const EMPTY = {
  identity: "",
  personality: "",
  speechStyle: "",
  goal: "",
  extra: "",
  major: false,
};

describe("normalizeProfile（异常安全归一）", () => {
  it("null / undefined / 非对象 → 全空（major=false）", () => {
    expect(normalizeProfile(null)).toEqual(EMPTY);
    expect(normalizeProfile(undefined)).toEqual(EMPTY);
    expect(normalizeProfile(123 as unknown as Record<string, unknown>)).toEqual(EMPTY);
  });

  it("缺字段 → 空串；文本 trim", () => {
    expect(normalizeProfile({})).toEqual(EMPTY);
    expect(normalizeProfile({ identity: "  甲  " }).identity).toBe("甲");
    expect(normalizeProfile({}).speechStyle).toBe("");
  });

  it("非文本字段 → 空串", () => {
    expect(normalizeProfile({ identity: 42 }).identity).toBe("");
    expect(normalizeProfile({ goal: null }).goal).toBe("");
    expect(normalizeProfile({ extra: { a: 1 } }).extra).toBe("");
  });

  it("major 仅 `true` 为 true（字符串/数字/缺省 → false）", () => {
    expect(normalizeProfile({ major: true }).major).toBe(true);
    expect(normalizeProfile({ major: "true" }).major).toBe(false);
    expect(normalizeProfile({ major: 1 }).major).toBe(false);
    expect(normalizeProfile({}).major).toBe(false);
  });

  it("PROFILE_TEXT_KEYS 与 CHARACTER_PROFILE_KEYS **同源**（排除 major）", () => {
    expect(PROFILE_TEXT_KEYS).toEqual(["identity", "personality", "speechStyle", "goal", "extra"]);
    expect([...CHARACTER_PROFILE_KEYS]).toEqual([...PROFILE_TEXT_KEYS, "major"]);
  });
});

describe("toProfileRecord（落库记录：仅契约字段）", () => {
  it("只含契约字段（无多余键）", () => {
    const record = toProfileRecord(normalizeProfile({ identity: "甲", major: true }));
    expect(Object.keys(record).sort()).toEqual([
      "extra",
      "goal",
      "identity",
      "major",
      "personality",
      "speechStyle",
    ]);
    expect(record.identity).toBe("甲");
    expect(record.major).toBe(true);
  });
});

describe("契约一致性（表单字段 ↔ Agent 引用同源）", () => {
  it("归一后的 profile 经 buildCharacterAgentPrompt → 要素出现在 system", () => {
    const profile = normalizeProfile({ identity: "侠客甲", speechStyle: "冷峻寡言" });
    const { system } = buildCharacterAgentPrompt({ profile, publicContext: "前文" });
    expect(system).toContain("侠客甲");
    expect(system).toContain("冷峻寡言");
  });
});

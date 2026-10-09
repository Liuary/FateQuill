import { describe, expect, it } from "vitest";
import {
  INPUT_TOKENS_PER_BRANCH_DEFAULT,
  OUTPUT_TOKEN_LIMIT_DEFAULT,
} from "@/orchestration/exploration/cost";
import { estimateDialogueCost, selectParticipants } from "./cost";
import { normalizeProfile } from "./profile";

describe("estimateDialogueCost（参与角色数 × 输出上限）", () => {
  it("默认口径：participantCount ×（输出上限 + 输入估算）", () => {
    const estimate = estimateDialogueCost(3);
    const perBranch = OUTPUT_TOKEN_LIMIT_DEFAULT + INPUT_TOKENS_PER_BRANCH_DEFAULT;
    expect(estimate.tokens).toBe(3 * perBranch);
    expect(estimate.note).toContain("参与角色数");
    expect(estimate.note).toContain(String(OUTPUT_TOKEN_LIMIT_DEFAULT));
    expect(estimate.note).toContain(String(INPUT_TOKENS_PER_BRANCH_DEFAULT));
  });

  it("可覆盖输出上限 / 输入估算", () => {
    expect(estimateDialogueCost(2, { outputLimit: 100, inputTokensPerBranch: 50 }).tokens).toBe(
      300,
    );
  });

  it("0 / 负参与数 → 0", () => {
    expect(estimateDialogueCost(0).tokens).toBe(0);
    expect(estimateDialogueCost(-4).tokens).toBe(0);
  });
});

describe("selectParticipants（major 过滤）", () => {
  const characters = [
    { id: 1, name: "甲", profile: normalizeProfile({ identity: "守塔人", major: true }) },
    { id: 2, name: "乙", profile: normalizeProfile({ identity: "船工", major: false }) },
    { id: 3, name: "丙", profile: normalizeProfile({ identity: "掌柜" }) }, // major 缺省 → false
    { id: 4, name: "丁", profile: normalizeProfile({ identity: "巡夜人", major: true }) },
  ];

  it("majorOnly=false（缺省）→ 全部参与", () => {
    expect(selectParticipants(characters).map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });

  it("majorOnly=true → 仅 major=true 入选", () => {
    expect(selectParticipants(characters, { majorOnly: true }).map((c) => c.id)).toEqual([1, 4]);
  });

  it("原始 JSON profile 亦按 major 过滤（经 normalizeProfile）", () => {
    const raw = [
      { id: 1, name: "甲", profile: { identity: "守塔人", major: true } },
      { id: 2, name: "乙", profile: { identity: "船工", major: "true" } }, // 非布尔 → false
    ];
    expect(selectParticipants(raw, { majorOnly: true }).map((c) => c.id)).toEqual([1]);
  });

  it("不改原数组", () => {
    const input = [...characters];
    selectParticipants(input, { majorOnly: true });
    expect(input).toHaveLength(4);
  });
});

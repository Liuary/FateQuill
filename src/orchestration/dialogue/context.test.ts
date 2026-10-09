import { describe, expect, it } from "vitest";
import {
  buildCharacterAgentInput,
  buildPublicContext,
  buildPublicSummary,
  type OtherCharacter,
  type PublicContextInput,
} from "./context";
import { toCharacterOptions } from "./generate";
import { normalizeProfile } from "./profile";
import type { ModelRef } from "@/orchestration/types";

const modelRef: ModelRef = { providerId: "openai-compatible", model: "m" };

/** 角色 A：persona 含**秘密** X（`personality`）与私有 `goal`/`speechStyle` */
const A: OtherCharacter = {
  id: 1,
  name: "甲",
  profile: normalizeProfile({
    identity: "守塔人",
    personality: "月蚀之夜弑父", // ← 秘密 X
    speechStyle: "絮叨",
    goal: "赎罪",
    extra: "左手有疤",
  }),
};

/** 角色 B：被生成的说话人（自身 persona 完整） */
const B_PROFILE = normalizeProfile({
  identity: "渡口船工",
  personality: "沉默寡言",
  speechStyle: "短句",
});

const PUBLIC_INPUT: PublicContextInput = {
  settingCards: [{ title: "青灯", content: "青灯引航，子夜前挂三盏" }],
  previousChapterTail: "前文末尾：他握紧了断刃。",
  sceneInstruction: "雨夜，渡口。",
  history: [{ speaker: "甲", content: "你来了。" }],
};

const publicContext = buildPublicContext(PUBLIC_INPUT);
/** B 的完整输入（白名单装配） */
const buildB = (others: OtherCharacter[] = [A]) =>
  buildCharacterAgentInput({ selfProfile: B_PROFILE, publicContext, others });
const flatten = (input: { system: string; user: string }) => `${input.system}\n${input.user}`;

describe("① 串味断言（核心）：A 的秘密 X 不出现在 B 的 prompt", () => {
  it("B 的 system+user 不含 A 的秘密 / 私有字段", () => {
    const text = flatten(buildB());
    expect(text).not.toContain("月蚀之夜弑父"); // 秘密 X
    expect(text).not.toContain("赎罪"); // A 的 goal
    expect(text).not.toContain("絮叨"); // A 的 speechStyle
    expect(text).not.toContain("左手有疤"); // A 的 extra
  });
});

describe("② 摘要断言：含他人公开身份一行摘要，不含其私有细节", () => {
  it("含「他人（公开身份）：守塔人」；不含 A 私有字段", () => {
    const input = buildB();
    expect(input.user).toContain("他人（公开身份）：守塔人");
    expect(input.user).not.toContain("月蚀之夜弑父");
    expect(input.user).not.toContain("赎罪");
  });

  it("buildPublicSummary：仅 identity；缺省回退角色名", () => {
    expect(buildPublicSummary(A.profile, "甲")).toBe("守塔人");
    expect(buildPublicSummary({}, "甲")).toBe("甲"); // identity 缺省 → 角色名
    expect(buildPublicSummary(undefined, "甲")).toBe("甲");
    expect(buildPublicSummary({ personality: "秘密" }, "甲")).toBe("甲"); // 私有字段不参与摘要
  });
});

describe("③ 公共要素断言：含公共场景 + 公共对话历史", () => {
  it("设定卡 / 前文 / 场景指令 / 已定稿对话均在 user 段", () => {
    const { user } = buildB();
    expect(user).toContain("青灯引航，子夜前挂三盏"); // 设定卡
    expect(user).toContain("前文末尾：他握紧了断刃。");
    expect(user).toContain("雨夜，渡口。"); // 场景指令
    expect(user).toContain("甲：你来了。"); // 公共对话历史
  });

  it("本人 persona 完整出现在 system（可正常扮演）", () => {
    const { system } = buildB();
    expect(system).toContain("渡口船工");
    expect(system).toContain("沉默寡言");
    expect(system).toContain("短句");
  });

  it("buildPublicContext 不含任何他人摘要（公共域纯净）", () => {
    expect(publicContext).not.toContain("公开身份");
    expect(buildPublicContext({})).toBe("");
  });
});

describe("④ 白名单穷举：仅 self persona 全文被包含", () => {
  it("多角色注入 → 仅 B 的 persona 全文可见，其余仅摘要", () => {
    const others: OtherCharacter[] = [
      A,
      {
        id: 2,
        name: "丙",
        profile: normalizeProfile({
          identity: "药铺掌柜",
          personality: "私下贩毒",
          speechStyle: "圆滑",
          goal: "吞并渡口",
          extra: "丙的秘密",
        }),
      },
      {
        id: 3,
        name: "丁",
        profile: normalizeProfile({
          identity: "巡夜人",
          personality: "丁的秘密",
          goal: "丁的目标",
        }),
      },
    ];
    const text = flatten(buildB(others));

    // ① 仅 self persona 全文
    expect(text).toContain("渡口船工");
    expect(text).toContain("沉默寡言");
    // ② 他人仅公开身份摘要
    for (const identity of ["守塔人", "药铺掌柜", "巡夜人"]) {
      expect(text).toContain(`他人（公开身份）：${identity}`);
    }
    // ③ 他人的私有字段一概不出现
    for (const secret of [
      "月蚀之夜弑父",
      "赎罪",
      "絮叨",
      "左手有疤",
      "私下贩毒",
      "圆滑",
      "吞并渡口",
      "丙的秘密",
      "丁的秘密",
      "丁的目标",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("未提供 others → 无他人摘要行（缺省安全）", () => {
    const input = buildCharacterAgentInput({ selfProfile: B_PROFILE, publicContext });
    expect(input.user).not.toContain("公开身份");
    expect(input.user).toContain("渡口船工".length > 0 ? "雨夜" : "");
  });
});

describe("⑤ 生产接线：toCharacterOptions 仅经白名单装配", () => {
  it("他人只以公开身份摘要进入 messages；秘密不外泄", () => {
    const options = toCharacterOptions({
      profile: B_PROFILE,
      publicContext,
      modelRef,
      others: [A],
    });
    const text = options.messages.map((message) => message.content).join("\n");
    expect(text).toContain("他人（公开身份）：守塔人");
    expect(text).not.toContain("月蚀之夜弑父");
    expect(text).toContain("渡口船工"); // self 完整
  });
});

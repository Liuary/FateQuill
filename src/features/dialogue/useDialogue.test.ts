import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ChatOptions } from "@/orchestration/types";
import { buildPublicContext } from "@/orchestration/dialogue/context";
import { normalizeProfile } from "@/orchestration/dialogue/profile";
import { useDialogueStore } from "@/store/dialogueStore";
import { useDialogue } from "./useDialogue";

const hoisted = vi.hoisted(() => ({
  streamOptions: [] as ChatOptions[],
  providerStream: vi.fn(),
}));

vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: (options: ChatOptions) => {
      hoisted.streamOptions.push(options);
      return hoisted.providerStream();
    },
  }),
}));

// BUG-001 核心：断言**生产调用** `context.buildPublicContext` 非零（spy 包装真实实现）
vi.mock("@/orchestration/dialogue/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/orchestration/dialogue/context")>();
  return { ...actual, buildPublicContext: vi.fn(actual.buildPublicContext) };
});

const config: ModelConfig = {
  id: 1,
  provider: "openai-compatible",
  label: "default",
  baseUrl: "https://api.example.com",
  modelName: "m",
  temperature: 0.7,
  isDefault: true,
  createdAt: "c",
  updatedAt: "u",
};

const speaker = {
  id: 1,
  name: "林砚",
  profile: normalizeProfile({ identity: "侠客甲", speechStyle: "冷峻寡言" }),
};

const scene = () => ({
  settingCards: [{ title: "世界观", content: "潮汐随月相起落" }],
  previousChapterTail: "前一章末尾片段",
  sceneInstruction: "雨夜破庙",
});

const emptyScene = { settingCards: [], previousChapterTail: "", sceneInstruction: "" };

const textOf = (options: ChatOptions) =>
  options.messages.map((message) => message.content).join("\n");

beforeEach(() => {
  hoisted.streamOptions.length = 0;
  hoisted.providerStream.mockReset();
  hoisted.providerStream.mockImplementation(async function* () {
    yield { delta: "……" };
  });
  vi.mocked(buildPublicContext).mockClear();
  useDialogueStore.setState({ entries: [], running: false });
});

describe("useDialogue（生产场景上下文装配，BUG-001）", () => {
  it("旁白路径：**四块同时进入实际 `options`** + `buildPublicContext` 生产调用非零", async () => {
    useDialogueStore.setState({
      entries: [
        {
          id: "h1",
          kind: "dialogue",
          speakerId: 2,
          speakerName: "阿禾",
          content: "我先到。",
          orderIndex: 0,
        },
      ],
      running: false,
    });

    const { result } = renderHook(() => useDialogue({ config, scene: scene() }));
    await act(async () => {
      await result.current.generateNarration();
    });

    expect(hoisted.streamOptions).toHaveLength(1);
    const text = textOf(hoisted.streamOptions[0]);
    // ① 设定卡 ② 前章末尾 ③ 场景指令 ④ 公共对话历史
    expect(text).toContain("【设定】");
    expect(text).toContain("世界观: 潮汐随月相起落");
    expect(text).toContain("【前文】");
    expect(text).toContain("前一章末尾片段");
    expect(text).toContain("【场景指令】");
    expect(text).toContain("雨夜破庙");
    expect(text).toContain("【已定稿对话】");
    expect(text).toContain("阿禾：我先到。");
    // 生产调用非零（>=1）
    expect(vi.mocked(buildPublicContext).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("角色路径：同样**四块完整装配**，且 system 仍为本人 persona（白名单不受影响）", async () => {
    const { result } = renderHook(() => useDialogue({ config, scene: scene() }));
    await act(async () => {
      await result.current.generateCharacterLine(speaker);
    });

    const options = hoisted.streamOptions[0];
    expect(textOf(options)).toContain("【场景指令】");
    expect(textOf(options)).toContain("雨夜破庙");
    expect(options.messages[0].content).toContain("冷峻寡言"); // 本人 persona
    expect(vi.mocked(buildPublicContext).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("批量路径：`generateBatchLines` 亦经完整装配", async () => {
    const { result } = renderHook(() => useDialogue({ config, scene: scene() }));
    await act(async () => {
      await result.current.generateBatchLines([speaker]);
    });

    expect(hoisted.streamOptions).toHaveLength(1);
    const text = textOf(hoisted.streamOptions[0]);
    expect(text).toContain("【设定】");
    expect(text).toContain("【前文】");
    expect(text).toContain("【场景指令】");
  });

  it("反向：四块输入为空 → 对应块**不出现**（零副作用）", async () => {
    const { result } = renderHook(() => useDialogue({ config, scene: emptyScene }));
    await act(async () => {
      await result.current.generateNarration();
    });

    const text = textOf(hoisted.streamOptions[0]);
    expect(text).not.toContain("【设定】");
    expect(text).not.toContain("【前文】");
    expect(text).not.toContain("【场景指令】");
    expect(text).not.toContain("【已定稿对话】");
  });
});

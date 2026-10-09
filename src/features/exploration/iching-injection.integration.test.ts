/**
 * 起卦 → 开关 → 装配 → 运行 **组合链路**集成用例（stage-09 REV-009① 清理）
 *
 * 覆盖「端到端」路径：`deriveHexagram(castManual(...))` → `explorationStore.setCasting` →
 * `setIChingEnabled(true/false)` → `useExploration.run()` → **送入模型的 `messages` system 段**。
 * 反向用例同时验证**关闭零副作用**（system 与基线逐字段一致）。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import i18n from "@/app/i18n";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ChatOptions } from "@/orchestration/types";
import { deriveHexagram } from "@/orchestration/iching/derive";
import { castManual } from "@/orchestration/iching/random";
import { useExplorationStore } from "@/store/explorationStore";
import { buildExplorationOptions } from "./build-exploration-options";
import { useExploration } from "./useExploration";

const hoisted = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  streamOptions: [] as ChatOptions[],
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: (options: ChatOptions) => {
      hoisted.streamOptions.push(options); // 捕获**真实送入模型**的 options
      return (async function* () {
        yield { delta: '{"summary":"走向","keyTurns":[],"settingCardIds":[]}' };
      })();
    },
  }),
}));

const cardRow = {
  id: 1,
  novel_id: 1,
  title: "青灯",
  content: "青灯引航",
  kind: "general",
  created_at: "c",
};

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

/** 取捕获到的 system 段文本 */
const capturedSystem = () => {
  const options = hoisted.streamOptions[hoisted.streamOptions.length - 1];
  return options.messages.find((message) => message.role === "system")!.content;
};

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) =>
    cmd === "list_setting_cards" ? Promise.resolve([cardRow]) : Promise.resolve(undefined),
  );
  hoisted.streamOptions.length = 0;
  useExplorationStore.setState({
    intent: "北上",
    temperatures: [0.7],
    branches: [],
    running: false,
    selectedBranchId: null,
    collapsedIds: [],
    casting: null,
    ichingEnabled: false,
  });
});

describe("起卦 → 开关 → 装配 → 运行（组合链路）", () => {
  it("开启且已起卦 → 送入模型的 system 段含卦象引导（含白文经文）", async () => {
    // 起卦（乾 + 初爻变）→ 入 store → 开启开关（store 单例，运行时语义）
    useExplorationStore.getState().setCasting(deriveHexagram(castManual("111111", [0])));
    useExplorationStore.getState().setIChingEnabled(true);

    const { result } = renderHook(() => useExploration({ novelId: 1, chapterId: null, config }));
    await act(async () => {
      await result.current.run();
    });

    expect(hoisted.streamOptions).toHaveLength(1);
    const system = capturedSystem();
    expect(system).toContain("易经卦象引导：");
    expect(system).toContain("本卦：乾");
    expect(system).toContain("潜龙勿用"); // 经文原样（不译）
    // 既有设定约束仍在（并存，非替换）
    expect(system).toContain("用户设定约束");
  });

  it("关闭（已起卦但开关关闭）→ system 不含卦象文本，且与基线逐字段一致（零副作用）", async () => {
    useExplorationStore.getState().setCasting(deriveHexagram(castManual("111111", [0])));
    // ichingEnabled 保持 false

    const { result } = renderHook(() => useExploration({ novelId: 1, chapterId: null, config }));
    await act(async () => {
      await result.current.run();
    });

    const system = capturedSystem();
    expect(system).not.toContain("易经卦象引导");
    expect(system).not.toContain("潜龙勿用");

    // 与基线（不传 hexagramGuide）逐字段一致
    const baseline = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
    });
    expect(hoisted.streamOptions[0].messages).toEqual(baseline.options.messages);
  });

  it("开启但未起卦 → system 不含卦象文本（无 casting 即无引导）", async () => {
    useExplorationStore.getState().setIChingEnabled(true); // 开关开，但 casting 为 null

    const { result } = renderHook(() => useExploration({ novelId: 1, chapterId: null, config }));
    await act(async () => {
      await result.current.run();
    });

    const system = capturedSystem();
    expect(system).not.toContain("易经卦象引导");
  });
});

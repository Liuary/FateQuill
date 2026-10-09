import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { TURN_CARD_SYSTEM_PROMPT } from "@/orchestration/exploration/parse";
import { EXTRACTION_SYSTEM_PROMPT } from "@/orchestration/consistency/extract";
import { DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT } from "@/orchestration/prompts/chapter-generation";
import { useAutopilotStore } from "@/store/autopilotStore";
import { parseOutline } from "./parse-outline";
import { AutopilotPanel } from "./AutopilotPanel";

const hoisted = vi.hoisted(() => ({ invokeMock: vi.fn(), streamOptions: [] as unknown[] }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: (options: { messages: { role: string; content: string }[] }) => {
      hoisted.streamOptions.push(options);
      const system = options.messages[0].content;
      // 按 system 判定调用场景（推演 / 抽取 / 生成 / 审查）——**复核真机装配的复用契约**
      const text =
        system === TURN_CARD_SYSTEM_PROMPT
          ? JSON.stringify({ summary: "走向", keyTurns: [], settingCardIds: [] })
          : system === EXTRACTION_SYSTEM_PROMPT
            ? JSON.stringify({ settings: [] })
            : system === DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT
              ? "正文：雨点砸在瓦上。"
              : // 其余 = stage-06 四维审查（rubric 提示）→ 返回评分 JSON
                JSON.stringify({ score: 80, reasons: ["节奏稳"] });
      return (async function* () {
        yield { delta: text };
      })();
    },
  }),
}));

const cfgRow = {
  id: 1,
  provider: "openai-compatible",
  label: "default",
  base_url: "https://api.example.com",
  model_name: "m",
  temperature: 0.7,
  is_default: 1,
  created_at: "c",
  updated_at: "u",
};

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
    if (cmd === "keyring_exists") return Promise.resolve(true);
    if (cmd === "list_setting_cards") return Promise.resolve([]);
    if (cmd === "list_chapters") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
  hoisted.streamOptions.length = 0;
  useAutopilotStore.getState().reset();
});

describe("AutopilotPanel（全自动创作；生产接线）", () => {
  it("面板挂载（`autopilot-panel`）+ 大纲与配置控件齐备", async () => {
    render(<AutopilotPanel novelId={1} chapterId={null} />);
    expect(screen.getByTestId("autopilot-panel")).toBeInTheDocument();
    expect(screen.getByTestId("autopilot-outline")).toBeInTheDocument();
    expect(screen.getByTestId("autopilot-max-chapters")).toBeInTheDocument();
    expect(screen.getByTestId("autopilot-max-rewrites")).toBeInTheDocument();
    expect(screen.getByTestId("autopilot-threshold")).toBeInTheDocument();
    expect(screen.getByTestId("autopilot-auto-confirm")).toBeInTheDocument();
    // 空大纲 → 启动禁用
    expect((screen.getByTestId("autopilot-start") as HTMLButtonElement).disabled).toBe(true);
  });

  it("parseOutline：每行一章；`标题：指令` 亦可；空行忽略", () => {
    expect(parseOutline("第一章：初遇\n\n第二章：灯塔熄灭")).toEqual([
      { index: 0, title: "第一章", instruction: "初遇" },
      { index: 1, title: "第二章", instruction: "灯塔熄灭" },
    ]);
    expect(parseOutline("   ")).toEqual([]);
  });

  it("启动 → 经 store 反馈进度与报告；真机依赖装配复用既有契约（推演/审查/抽取/生成）", async () => {
    render(<AutopilotPanel novelId={1} chapterId={null} />);
    fireEvent.change(screen.getByTestId("autopilot-outline"), {
      target: { value: "第一章：初遇\n第二章：灯塔熄灭" },
    });
    await waitFor(() =>
      expect((screen.getByTestId("autopilot-start") as HTMLButtonElement).disabled).toBe(false),
    );

    fireEvent.click(screen.getByTestId("autopilot-start"));

    await waitFor(() => expect(useAutopilotStore.getState().status).toBe("done"));
    const state = useAutopilotStore.getState();
    expect(state.chapters).toHaveLength(2); // 2 章大纲 → 2 章产出
    expect(state.report?.chapters).toHaveLength(2);
    expect(state.report?.passed).toBe(2); // 审查均为 80 ≥ 阈值 60（**过阈或降级**）
    await waitFor(() => expect(screen.getByTestId("autopilot-report")).toBeInTheDocument());

    // 真机装配链路的复用证据：推演契约 / 章节系统提示 / 审查 rubric / 归档抽取 均被调用
    const systems = hoisted.streamOptions.map(
      (options) => (options as { messages: { content: string }[] }).messages[0].content,
    );
    expect(systems).toContain(TURN_CARD_SYSTEM_PROMPT);
    expect(systems).toContain(DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT);
    expect(systems).toContain(EXTRACTION_SYSTEM_PROMPT);
    // 审查走 stage-06 rubric 提示（非上述三者即审查调用）
    expect(
      systems.some(
        (system) =>
          system !== TURN_CARD_SYSTEM_PROMPT &&
          system !== EXTRACTION_SYSTEM_PROMPT &&
          system !== DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT,
      ),
    ).toBe(true);
  });
});

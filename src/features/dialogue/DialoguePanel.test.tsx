import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/app/i18n";
import type { ChatOptions } from "@/orchestration/types";
import { useDialogueStore } from "@/store/dialogueStore";
import { DialoguePanel } from "./DialoguePanel";

const hoisted = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  providerStream: vi.fn(),
  streamOptions: [] as ChatOptions[],
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: (options: ChatOptions) => {
      hoisted.streamOptions.push(options);
      return hoisted.providerStream();
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

const characterRow = {
  id: 1,
  novel_id: 1,
  name: "林砚",
  profile: JSON.stringify({ identity: "侠客甲", speechStyle: "冷峻寡言", goal: "找回断刃" }),
};

const entries = () => useDialogueStore.getState().entries;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
    if (cmd === "keyring_exists") return Promise.resolve(true);
    if (cmd === "list_characters") return Promise.resolve([characterRow]);
    return Promise.resolve(undefined);
  });
  hoisted.providerStream.mockReset();
  hoisted.streamOptions.length = 0;
  useDialogueStore.setState({ entries: [], running: false });
});

describe("DialoguePanel（旁白 / 对话分离，T2）", () => {
  it("旁白与角色台词**可分别生成**（各自入口、各自入列）", async () => {
    hoisted.providerStream.mockImplementation(async function* () {
      yield { delta: "雾散开，河面上浮出一层白光。" };
    });
    render(<DialoguePanel novelId={1} />);
    await waitFor(() => expect(screen.getByTestId("dialogue-panel")).toBeInTheDocument());

    // 入口分离：旁白区 与 对话区 各自独立
    expect(screen.getByTestId("narration-composer")).toBeInTheDocument();
    expect(screen.getByTestId("character-line-composer")).toBeInTheDocument();

    // ① 生成旁白
    fireEvent.click(screen.getByRole("button", { name: "生成旁白" }));
    await waitFor(() => expect(entries()).toHaveLength(1));
    expect(entries()[0].kind).toBe("narration");
    expect(entries()[0].content).toContain("雾散开");
    expect(entries()[0].orderIndex).toBe(0);

    // ② 生成角色台词（选中说话人）
    hoisted.providerStream.mockImplementation(async function* () {
      yield { delta: "「你确定要走？」" };
    });
    await waitFor(() =>
      expect(
        within(screen.getByTestId("character-line-composer")).getAllByRole("option").length,
      ).toBeGreaterThan(1),
    );
    const options = within(screen.getByTestId("character-line-composer")).getAllByRole(
      "option",
    ) as HTMLOptionElement[];
    fireEvent.change(within(screen.getByTestId("character-line-composer")).getByRole("combobox"), {
      target: { value: options[1].value },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成台词" }));

    await waitFor(() => expect(entries()).toHaveLength(2));
    expect(entries()[1].kind).toBe("dialogue");
    expect(entries()[1].speakerId).toBe(1);
    expect(entries()[1].speakerName).toBe("林砚");
    expect(entries()[1].orderIndex).toBe(1);
    // 角色 persona（profile JSON）经装配注入 system
    expect(hoisted.streamOptions[1].messages[0].content).toContain("侠客甲");
  });

  it("旁白与对话**可分别编辑**（行内编辑互不影响）", async () => {
    useDialogueStore.setState({
      entries: [
        { id: "a", kind: "narration", content: "原旁白", orderIndex: 0 },
        {
          id: "b",
          kind: "dialogue",
          speakerId: 1,
          speakerName: "林砚",
          content: "原台词",
          orderIndex: 1,
        },
      ],
    });
    render(<DialoguePanel novelId={1} />);
    await waitFor(() => expect(screen.getAllByTestId("dialogue-entry")).toHaveLength(2));

    fireEvent.change(screen.getByLabelText("条目内容-0"), { target: { value: "改后旁白" } });
    expect(entries()[0].content).toBe("改后旁白");
    expect(entries()[1].content).toBe("原台词"); // 互不影响

    fireEvent.change(screen.getByLabelText("条目内容-1"), { target: { value: "改后台词" } });
    expect(entries()[1].content).toBe("改后台词");
    expect(entries()[0].content).toBe("改后旁白");

    // 对话条目显示 `说话人：`
    expect(screen.getAllByTestId("dialogue-entry")[1].textContent).toContain("林砚");
  });

  it("条目增删改可判定（顺序恒连续）", async () => {
    useDialogueStore.setState({
      entries: [
        { id: "a", kind: "narration", content: "一", orderIndex: 0 },
        { id: "b", kind: "narration", content: "二", orderIndex: 1 },
      ],
    });
    render(<DialoguePanel novelId={1} />);
    await waitFor(() => expect(screen.getAllByTestId("dialogue-entry")).toHaveLength(2));

    // 上移第二条 → 顺序交换且 orderIndex 连续
    fireEvent.click(
      within(screen.getAllByTestId("dialogue-entry")[1]).getByRole("button", { name: "上移" }),
    );
    expect(entries().map((entry) => entry.content)).toEqual(["二", "一"]);
    expect(entries().map((entry) => entry.orderIndex)).toEqual([0, 1]);

    // 上方插入空条目 → 重排连续
    fireEvent.click(
      within(screen.getAllByTestId("dialogue-entry")[0]).getByRole("button", { name: "上方插入" }),
    );
    expect(entries()).toHaveLength(3);
    expect(entries().map((entry) => entry.orderIndex)).toEqual([0, 1, 2]);

    // 删除一条 → 重排连续
    fireEvent.click(
      within(screen.getAllByTestId("dialogue-entry")[1]).getByRole("button", { name: "删除" }),
    );
    expect(entries()).toHaveLength(2);
    expect(entries().map((entry) => entry.orderIndex)).toEqual([0, 1]);
  });

  it("无配置 → Key/设置引导；空历史提示", async () => {
    hoisted.invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_model_configs") return Promise.resolve([]);
      if (cmd === "list_characters") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    render(<DialoguePanel novelId={1} />);
    await waitFor(() => expect(screen.getByText(/设置/)).toBeInTheDocument());
    expect(screen.getByText("暂无条目")).toBeInTheDocument();
    expect(screen.getByText("暂无角色档案")).toBeInTheDocument();
  });
});

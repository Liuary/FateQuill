import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { useExplorationStore } from "@/store/explorationStore";
import { ExplorationPanel } from "./ExplorationPanel";

const hoisted = vi.hoisted(() => ({ invokeMock: vi.fn(), providerStream: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
// anthropic 分支：温度区间 [0,1] → 1.1 会被 clamp（用于断言标注）
vi.mock("@/orchestration/providers/anthropic", () => ({
  createAnthropicProvider: () => ({
    id: "anthropic",
    stream: () => hoisted.providerStream(),
  }),
}));

const cfgRow = {
  id: 1,
  provider: "anthropic",
  label: "claude",
  base_url: "https://api.anthropic.com",
  model_name: "claude-x",
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
    return Promise.resolve(undefined);
  });
  hoisted.providerStream.mockReset();
  hoisted.providerStream.mockImplementation(async function* () {
    yield { delta: '{"summary":"走向：北上结盟","keyTurns":["遇袭"],"settingCardIds":[1]}' };
  });
  useExplorationStore.setState({
    intent: "",
    temperatures: [0.3, 0.7, 1.1],
    branches: [],
    running: false,
  });
});

describe("ExplorationPanel（多温度并行推演）", () => {
  it("输入意向 + 运行 → 三分支渲染，且 clamp 分支被标注", async () => {
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByText("多温度并行推演")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("走向意向"), { target: { value: "北上" } });
    fireEvent.click(screen.getByRole("button", { name: "开始推演" }));

    await waitFor(() => expect(screen.getAllByTestId("exploration-branch")).toHaveLength(3));
    // 三分支各以指定温度下发
    expect(screen.getByText(/温度: 0\.3/)).toBeInTheDocument();
    expect(screen.getByText(/温度: 0\.7/)).toBeInTheDocument();
    // anthropic [0,1] → 1.1 被 clamp 至 1，并显式标注
    expect(
      screen.getByText(/温度: 1\.1 ｜ 有效温度: 1 ｜ 已按 provider 区间 clamp/),
    ).toBeInTheDocument();
    // 走向卡摘要渲染
    expect(screen.getAllByText("走向：北上结盟")).toHaveLength(3);
  });

  it("意向为空 → 运行按钮禁用", async () => {
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByText("多温度并行推演")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "开始推演" })).toBeDisabled();
    expect(screen.getByText("暂无分支")).toBeInTheDocument();
  });

  it("温度集可增删（配置写入 store）", async () => {
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByText("多温度并行推演")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "新增温度" }));
    expect(useExplorationStore.getState().temperatures).toHaveLength(4);

    fireEvent.click(screen.getAllByRole("button", { name: "移除" })[0]);
    expect(useExplorationStore.getState().temperatures).toHaveLength(3);
  });
});

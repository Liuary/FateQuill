import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { useExplorationStore } from "@/store/explorationStore";
import { ExplorationPanel } from "./ExplorationPanel";

const hoisted = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  providerStream: vi.fn(),
  guideCalls: [] as string[],
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
// anthropic 分支：温度区间 [0,1] → 1.1 会被 clamp（用于断言标注）
vi.mock("@/orchestration/providers/anthropic", () => ({
  createAnthropicProvider: () => ({
    id: "anthropic",
    stream: () => hoisted.providerStream(),
  }),
}));
// 卦象引导模块：记录调用以断言「关闭零副作用」
vi.mock("@/orchestration/iching", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/orchestration/iching")>();
  return {
    ...actual,
    buildGuideCard: (casting: Parameters<typeof actual.buildGuideCard>[0]) => {
      hoisted.guideCalls.push("buildGuideCard");
      return actual.buildGuideCard(casting);
    },
    renderGuideText: (card: Parameters<typeof actual.renderGuideText>[0]) => {
      hoisted.guideCalls.push("renderGuideText");
      return actual.renderGuideText(card);
    },
  };
});

const SAMPLE_CASTING = {
  benGua: {
    kingWen: 1,
    name: "乾",
    binary: "111111",
    upper: "乾",
    lower: "乾",
    judgment: "元亨利贞。",
    lines: ["初九：潜龙勿用。", "b", "c", "d", "e", "f"],
  },
  zhiGua: {
    kingWen: 2,
    name: "坤",
    binary: "000000",
    upper: "坤",
    lower: "坤",
    judgment: "元亨。",
    lines: ["a", "b", "c", "d", "e", "f"],
  },
  changingLines: [0],
  reading: { changingCount: 1, source: "ben" as const, lineIndices: [0] },
};

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
    selectedBranchId: null,
    collapsedIds: [],
    casting: null,
    ichingEnabled: false, // 单例开关：逐个用例显式复位（缺省关闭）
  });
  hoisted.guideCalls.length = 0;
  localStorage.clear(); // 易经开关缺省关闭
});

describe("ExplorationPanel（多温度并行推演）", () => {
  it("输入意向 + 运行 → 三分支渲染，且 clamp 分支被标注", async () => {
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByText("多温度并行推演")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("走向意向"), { target: { value: "北上" } });
    fireEvent.click(screen.getByRole("button", { name: "开始推演" }));

    await waitFor(() => expect(screen.getAllByTestId("branch-card")).toHaveLength(3));
    // 三分支各以指定温度下发
    const cards = screen.getAllByTestId("branch-card");
    expect(cards[0].textContent).toContain("温度: 0.3");
    expect(cards[1].textContent).toContain("温度: 0.7");
    // anthropic [0,1] → 1.1 被 clamp 至 1，并显式标注
    expect(cards[2].textContent).toContain("温度: 1.1");
    expect(cards[2].textContent).toContain("有效温度: 1");
    expect(cards[2].textContent).toContain("已按 provider 区间 clamp");
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

  it("易经开关：缺省关闭（起卦/宿命入口不可见、卦象模块零调用）", async () => {
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByText("多温度并行推演")).toBeInTheDocument());

    const toggle = screen.getByTestId("iching-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(localStorage.getItem("fatequill.iching.enabled")).toBeNull(); // 缺省不写存储
    expect(screen.queryByTestId("iching-panel")).toBeNull();
    expect(screen.queryByTestId("fate-panel")).toBeNull();
    expect(hoisted.guideCalls).toEqual([]); // 关闭 → 卦象模块零调用
  });

  it("易经开关：切换开启 → 持久化 + 起卦区显隐；关闭 → 复原", async () => {
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByText("多温度并行推演")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("iching-toggle"));
    expect(localStorage.getItem("fatequill.iching.enabled")).toBe("true");
    expect(screen.getByTestId("iching-panel")).toBeInTheDocument();
    expect(screen.getByTestId("fate-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("iching-toggle"));
    expect(localStorage.getItem("fatequill.iching.enabled")).toBe("false");
    expect(screen.queryByTestId("iching-panel")).toBeNull();
    expect(screen.queryByTestId("fate-panel")).toBeNull();
  });

  it("开启 + 已起卦 → 卦象引导被构建（非零调用）", async () => {
    useExplorationStore.setState({
      ichingEnabled: true, // 单例开关：经 store 动作（运行时语义）
      casting: SAMPLE_CASTING,
    });
    render(<ExplorationPanel novelId={1} chapterId={null} />);

    await waitFor(() => expect(hoisted.guideCalls).toContain("buildGuideCard"));
    expect(hoisted.guideCalls).toContain("renderGuideText");
  });

  it("运行时切换开关即时生效（BUG-001）：开启非零调用 / 关闭零调用", async () => {
    useExplorationStore.setState({ casting: SAMPLE_CASTING }); // 已起卦，开关仍关闭
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByText("多温度并行推演")).toBeInTheDocument());
    expect(hoisted.guideCalls).toEqual([]); // 关闭 → 零调用

    // 运行时点击开启（无需重挂载）→ 引导被构建
    fireEvent.click(screen.getByTestId("iching-toggle"));
    await waitFor(() => expect(hoisted.guideCalls).toContain("buildGuideCard"));
    expect(hoisted.guideCalls).toContain("renderGuideText");
    expect(localStorage.getItem("fatequill.iching.enabled")).toBe("true"); // 持久化

    // 运行时点击关闭 → 零调用
    hoisted.guideCalls.length = 0;
    fireEvent.click(screen.getByTestId("iching-toggle"));
    await waitFor(() =>
      expect((screen.getByTestId("iching-toggle") as HTMLInputElement).checked).toBe(false),
    );
    expect(hoisted.guideCalls).toEqual([]);
    expect(localStorage.getItem("fatequill.iching.enabled")).toBe("false");
  });
});

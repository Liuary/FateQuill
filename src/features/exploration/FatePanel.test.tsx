import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/app/i18n";
import { useExplorationStore } from "@/store/explorationStore";
import { ExplorationPanel } from "./ExplorationPanel";
import { ICHING_ENABLED_STORAGE_KEY } from "./useIChingEnabled";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const characterRow = { id: 1, novel_id: 1, name: "林砚", profile: "{}" };
const settingCardRow = {
  id: 7,
  novel_id: 1,
  title: "青灯",
  content: "青灯引航",
  kind: "general",
  created_at: "c",
};
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

const setEnabled = (value: boolean) =>
  localStorage.setItem(ICHING_ENABLED_STORAGE_KEY, String(value));

const writeArgs = () =>
  invokeMock.mock.calls.find((call) => call[0] === "create_setting_card")?.[1] as
    Record<string, unknown> | undefined;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  localStorage.clear();
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
    if (cmd === "keyring_exists") return Promise.resolve(true);
    if (cmd === "list_characters") return Promise.resolve([characterRow]);
    if (cmd === "list_setting_cards") return Promise.resolve([settingCardRow]);
    if (cmd === "create_setting_card") return Promise.resolve({ ...settingCardRow, kind: "fate" });
    return Promise.resolve(undefined);
  });
  useExplorationStore.setState({
    intent: "",
    temperatures: [0.3, 0.7, 1.1],
    branches: [],
    running: false,
    selectedBranchId: null,
    collapsedIds: [],
    casting: null,
  });
});

describe("FatePanel（角色宿命映射，T4）", () => {
  it("未开启（缺省关闭）→ 起卦/宿命入口不可见", () => {
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    expect(screen.queryByTestId("iching-panel")).toBeNull();
    expect(screen.queryByTestId("fate-panel")).toBeNull();
  });

  it("开启后：起卦 → 选目标 → 产出宿命卡 → 写入设定卡（kind=fate，零迁移复用）", async () => {
    setEnabled(true);
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByTestId("fate-panel")).toBeInTheDocument());
    expect(screen.getByTestId("iching-panel")).toBeInTheDocument();

    // 起卦（手动：乾 + 初爻变）
    fireEvent.change(screen.getByLabelText("本卦二进制"), { target: { value: "111111" } });
    fireEvent.change(screen.getByLabelText("变爻下标"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "手动起卦" }));
    await waitFor(() => expect(useExplorationStore.getState().casting?.benGua.name).toBe("乾"));

    // 选定目标（角色）
    await waitFor(() =>
      expect(within(screen.getByLabelText("目标")).getAllByRole("option").length).toBeGreaterThan(
        1,
      ),
    );
    const options = within(screen.getByLabelText("目标")).getAllByRole(
      "option",
    ) as HTMLOptionElement[];
    fireEvent.change(screen.getByLabelText("目标"), { target: { value: options[1].value } });

    // 产出宿命卡
    fireEvent.click(screen.getByRole("button", { name: "产出宿命卡" }));
    const card = screen.getByTestId("fate-card");
    expect(card.textContent).toContain("宿命·乾");
    expect(card.textContent).toContain("对象：林砚");

    // 写入设定卡（REV-008：仅新建宿命卡单一路径）
    fireEvent.click(screen.getByRole("button", { name: "写入设定卡" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("create_setting_card", expect.anything()),
    );
    expect(writeArgs()?.kind).toBe("fate");
    expect(String(writeArgs()?.title)).toContain("宿命·乾");
    expect(String(writeArgs()?.content)).toContain("对象：林砚");
    expect(writeArgs()?.novelId).toBe(1);
    expect(screen.getByText("已写入设定卡")).toBeInTheDocument();
  });

  it("未起卦 / 未选目标 → 产出与写入按钮禁用", async () => {
    setEnabled(true);
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByTestId("fate-panel")).toBeInTheDocument());

    expect(screen.getByText("请先起卦")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "产出宿命卡" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "写入设定卡" })).toBeDisabled();
  });

  it("写入失败 → 提示且不静默", async () => {
    setEnabled(true);
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
      if (cmd === "keyring_exists") return Promise.resolve(true);
      if (cmd === "list_characters") return Promise.resolve([characterRow]);
      if (cmd === "list_setting_cards") return Promise.resolve([]);
      if (cmd === "create_setting_card") {
        return Promise.reject({ code: "VALIDATION", message: "boom" });
      }
      return Promise.resolve(undefined);
    });
    render(<ExplorationPanel novelId={1} chapterId={null} />);
    await waitFor(() => expect(screen.getByTestId("fate-panel")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "手动起卦" }));
    await waitFor(() => expect(useExplorationStore.getState().casting).toBeTruthy());
    const options = within(screen.getByLabelText("目标")).getAllByRole(
      "option",
    ) as HTMLOptionElement[];
    fireEvent.change(screen.getByLabelText("目标"), { target: { value: options[1].value } });
    fireEvent.click(screen.getByRole("button", { name: "产出宿命卡" }));
    fireEvent.click(screen.getByRole("button", { name: "写入设定卡" }));

    await waitFor(() => expect(screen.getByText("写入失败，请重试")).toBeInTheDocument());
    expect(screen.queryByText("已写入设定卡")).toBeNull();
  });
});

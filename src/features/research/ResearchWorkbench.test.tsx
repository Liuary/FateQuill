import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/app/i18n";
import { repositories } from "@/ipc/repositories";
import { useEditorStore } from "@/store/editorStore";
import { useGenerationStore } from "@/store/generationStore";
import { useResearchStore } from "@/store/researchStore";
import { ResearchWorkbench } from "./ResearchWorkbench";

const hoisted = vi.hoisted(() => ({ invokeMock: vi.fn(), reviewSpy: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    async *stream() {
      yield { delta: "候选正文" };
    },
  }),
}));
// 「不触发审查」断言：评审回路**零调用**
vi.mock("@/orchestration/review/loop", () => ({ runReviewLoop: hoisted.reviewSpy }));

const cfgA = {
  id: 1,
  provider: "openai-compatible",
  label: "modelA",
  base_url: "https://a.example.com",
  model_name: "ma",
  temperature: 0,
  is_default: 1,
  created_at: "c",
  updated_at: "u",
};
const cfgB = { ...cfgA, id: 2, label: "modelB", model_name: "mb", is_default: 0 };

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([cfgA, cfgB]);
    if (cmd === "keyring_exists") return Promise.resolve(true);
    return Promise.resolve(undefined);
  });
  hoisted.reviewSpy.mockReset();
  useResearchStore.setState({ selectedConfigIds: [], candidates: [] });
  useEditorStore.setState({
    currentNovelId: null,
    currentChapterId: null,
    saveStatus: "saved",
    lastSavedAt: null,
  });
  useGenerationStore.getState().reset();
});

const checkboxes = () => screen.getAllByRole("checkbox") as HTMLInputElement[];

describe("ResearchWorkbench", () => {
  it("勾选模型 + 采样 → 候选渲染", async () => {
    render(<ResearchWorkbench />);
    await waitFor(() => expect(screen.getByText("modelA")).toBeInTheDocument());

    fireEvent.click(checkboxes()[0]); // 勾选 modelA
    fireEvent.change(screen.getByLabelText("创作指令"), { target: { value: "写一段雨夜" } });
    fireEvent.click(screen.getByRole("button", { name: "开始采样" }));

    await waitFor(() => expect(screen.getAllByTestId("material-candidate")).toHaveLength(1));
    const candidate = screen.getAllByTestId("material-candidate")[0];
    expect(within(candidate).getByText("候选正文")).toBeInTheDocument();
    expect(within(candidate).getByText("modelA")).toBeInTheDocument(); // 候选来源模型
  });

  it("无 Key → 禁用采样 + 引导设置", async () => {
    hoisted.invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_model_configs") return Promise.resolve([cfgA]);
      if (cmd === "keyring_exists") return Promise.resolve(false);
      return Promise.resolve(undefined);
    });

    render(<ResearchWorkbench />);
    await waitFor(() => expect(screen.getByText("modelA")).toBeInTheDocument());
    fireEvent.click(checkboxes()[0]);

    expect(screen.getAllByText("未配置 Key").length).toBeGreaterThan(0);
    expect(screen.getAllByText("请先在「设置」配置模型并写入 API Key").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "开始采样" })).toBeDisabled();
  });

  it("采样无副作用：不落 chapter / editor+generation 快照不变 / 不触发审查", async () => {
    const updateSpy = vi.spyOn(repositories.chapter, "update");
    useEditorStore.setState({
      currentNovelId: 1,
      currentChapterId: 2,
      saveStatus: "saved",
      lastSavedAt: null,
    });
    const editorBefore = useEditorStore.getState();
    const generationBefore = useGenerationStore.getState();

    render(<ResearchWorkbench />);
    await waitFor(() => expect(screen.getByText("modelA")).toBeInTheDocument());
    fireEvent.click(checkboxes()[0]);
    fireEvent.change(screen.getByLabelText("创作指令"), { target: { value: "写一段" } });
    fireEvent.click(screen.getByRole("button", { name: "开始采样" }));
    await waitFor(() => expect(screen.getAllByTestId("material-candidate")).toHaveLength(1));

    expect(updateSpy).not.toHaveBeenCalled(); // 不落 chapter
    expect(useEditorStore.getState()).toBe(editorBefore); // 不进正文 / 不自动保存
    expect(useGenerationStore.getState()).toBe(generationBefore);
    expect(hoisted.reviewSpy).not.toHaveBeenCalled(); // 不触发审查
  });
});

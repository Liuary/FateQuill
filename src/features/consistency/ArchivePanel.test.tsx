import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { useArchiveStore } from "@/store/archiveStore";
import { ArchivePanel } from "./ArchivePanel";

const hoisted = vi.hoisted(() => ({ invokeMock: vi.fn(), extraction: "" }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: () =>
      (async function* () {
        yield { delta: hoisted.extraction };
      })(),
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

const chapterRow = {
  id: 5,
  volume_id: 3,
  title: "第五章",
  content: "<p>月相更替之时，海面会随之涨落三丈。雾隐峡两侧有灯塔。</p>",
  content_format: "html",
  order_index: 0,
  status: "draft",
  word_count: 30,
  created_at: "c",
  updated_at: "u",
};

const argsOf = (cmd: string) =>
  hoisted.invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as
    Record<string, unknown> | undefined;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.extraction = JSON.stringify({
    settings: [
      {
        name: "潮汐律",
        kind: "世界观",
        suggestedTier: "main",
        content: "月相更替时海面涨落三丈",
        evidence: "月相更替之时，海面会随之涨落三丈",
      },
      {
        name: "雾隐峡灯塔",
        kind: "地理",
        suggestedTier: "dark",
        content: "峡谷两侧灯塔穿透浓雾",
        evidence: "雾隐峡两侧有灯塔",
      },
    ],
  });
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
    if (cmd === "keyring_exists") return Promise.resolve(true);
    if (cmd === "get_chapter") return Promise.resolve(chapterRow);
    if (cmd === "list_setting_cards") return Promise.resolve([]);
    if (cmd === "save_extracted_settings") {
      const items = (argsOf("save_extracted_settings")?.items as unknown[]) ?? [];
      return Promise.resolve(items.map((_, index) => ({ id: 100 + index })));
    }
    return Promise.resolve(undefined);
  });
  useArchiveStore.setState({ candidates: [] });
});

describe("ArchivePanel（归档本章 → 待确认 → 确认入库；BUG-001 生产可达）", () => {
  it("点「归档本章」→ `runExtraction` 生产路径贯通，候选渲染（含分级/依据）", async () => {
    render(<ArchivePanel novelId={1} chapterId={5} />);
    await waitFor(() => expect(screen.getByTestId("archive-panel")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("archive-button"));

    await waitFor(() => expect(screen.getAllByTestId("archive-candidate")).toHaveLength(2));
    expect(screen.getByText("潮汐律")).toBeInTheDocument();
    expect(screen.getByText("雾隐峡灯塔")).toBeInTheDocument();
    // 生产链路：章节加载 + 既有卡去重依据 + 候选入待确认队列（**未落库直达**）
    expect(hoisted.invokeMock.mock.calls.some((call) => call[0] === "get_chapter")).toBe(true);
    expect(
      hoisted.invokeMock.mock.calls.some((call) => call[0] === "save_extracted_settings"),
    ).toBe(false);
    expect(useArchiveStore.getState().candidates).toHaveLength(2);
  });

  it("点「确认入库」→ `save_extracted_settings` 被调用且 items **含 tier**（四级入参贯通）", async () => {
    render(<ArchivePanel novelId={1} chapterId={5} />);
    await waitFor(() => expect(screen.getByTestId("archive-panel")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("archive-button"));
    await waitFor(() => expect(screen.getAllByTestId("archive-candidate")).toHaveLength(2));

    fireEvent.click(screen.getByTestId("archive-confirm"));

    await waitFor(() =>
      expect(
        hoisted.invokeMock.mock.calls.some((call) => call[0] === "save_extracted_settings"),
      ).toBe(true),
    );
    expect(argsOf("save_extracted_settings")?.novelId).toBe(1);
    expect(argsOf("save_extracted_settings")?.items).toEqual([
      { title: "潮汐律", content: "月相更替时海面涨落三丈", kind: "世界观", tier: "main" },
      { title: "雾隐峡灯塔", content: "峡谷两侧灯塔穿透浓雾", kind: "地理", tier: "dark" },
    ]);
    // 落库后清空待确认队列
    expect(useArchiveStore.getState().candidates).toEqual([]);
  });

  it("候选分级可在面板内修正后入库（`archive-tier` 下拉）", async () => {
    render(<ArchivePanel novelId={1} chapterId={5} />);
    await waitFor(() => expect(screen.getByTestId("archive-panel")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("archive-button"));
    await waitFor(() => expect(screen.getAllByTestId("archive-candidate")).toHaveLength(2));

    fireEvent.change(screen.getAllByTestId("archive-tier")[0], { target: { value: "temp" } });
    fireEvent.click(screen.getByTestId("archive-confirm"));

    await waitFor(() =>
      expect(
        hoisted.invokeMock.mock.calls.some((call) => call[0] === "save_extracted_settings"),
      ).toBe(true),
    );
    const items = argsOf("save_extracted_settings")?.items as { tier: string }[];
    expect(items[0].tier).toBe("temp");
  });
});

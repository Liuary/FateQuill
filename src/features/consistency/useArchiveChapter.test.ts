import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ModelConfig } from "@/domain/models/model-config";
import { useArchiveStore } from "@/store/archiveStore";
import { useArchiveChapter } from "./useArchiveChapter";

const hoisted = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  extraction: "",
  failStream: false,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: () => {
      if (hoisted.failStream) {
        throw new Error("stream down");
      }
      return (async function* () {
        yield { delta: hoisted.extraction };
      })();
    },
  }),
}));

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

const chapterRow = {
  id: 5,
  volume_id: 3,
  title: "第五章",
  content:
    "<p>月相更替之时，海面会随之涨落三丈。雾隐峡两侧的灯塔，是唯一能穿透浓雾的光源。执灯人自两百年前起便守在峡口。</p>",
  content_format: "html",
  order_index: 0,
  status: "draft",
  word_count: 60,
  created_at: "c",
  updated_at: "u",
};

const existingRow = {
  id: 9,
  novel_id: 1,
  title: "潮汐律",
  content: "既有设定",
  kind: "世界观",
  tier: "main",
  created_at: "c",
};

const argsOf = (cmd: string) =>
  hoisted.invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as
    Record<string, unknown> | undefined;

const extractionJson = () =>
  JSON.stringify({
    settings: [
      {
        name: "潮汐律",
        kind: "世界观",
        suggestedTier: "main",
        content: "月相更替时海面涨落三丈",
        evidence: "月相更替之时，海面会随之涨落三丈",
      },
      {
        name: "雾隐峡",
        kind: "地理",
        suggestedTier: "short",
        content: "峡谷两侧有灯塔",
        evidence: "雾隐峡两侧的灯塔",
      },
      {
        name: "海神契约",
        kind: "世界观",
        suggestedTier: "main",
        content: "幻觉条目",
        evidence: "海神以潮汐为誓",
      },
    ],
  });

beforeEach(() => {
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "get_chapter") return Promise.resolve(chapterRow);
    if (cmd === "list_setting_cards") return Promise.resolve([existingRow]);
    if (cmd === "save_extracted_settings") {
      const items = (argsOf("save_extracted_settings")?.items as { title: string }[]) ?? [];
      return Promise.resolve(
        items.map((item, index) => ({ ...existingRow, id: 100 + index, title: item.title })),
      );
    }
    return Promise.resolve(undefined);
  });
  hoisted.extraction = extractionJson();
  hoisted.failStream = false;
  useArchiveStore.setState({ candidates: [] });
});

describe("useArchiveChapter（手动归档本章 → 待确认队列 → 确认落库）", () => {
  it("抽取后候选入**会话内存待确认队列**（不入库直达）；幻觉条目被剔除、同名标注 duplicate", async () => {
    const { result } = renderHook(() => useArchiveChapter({ config, novelId: 1, chapterId: 5 }));

    await act(async () => {
      await result.current.archiveChapter();
    });

    const candidates = useArchiveStore.getState().candidates;
    expect(candidates.map((c) => c.name)).toEqual(["潮汐律", "雾隐峡"]); // 海神契约（幻觉）已剔除
    expect(candidates.map((c) => c.status)).toEqual(["duplicate", "new"]);
    // **不入库直达**：确认前不得调用落库命令
    expect(
      hoisted.invokeMock.mock.calls.some((call) => call[0] === "save_extracted_settings"),
    ).toBe(false);
  });

  it("confirmAndSave 仅提交 `new` 候选（duplicate 不重复建卡）并清空队列", async () => {
    const { result } = renderHook(() => useArchiveChapter({ config, novelId: 1, chapterId: 5 }));
    await act(async () => {
      await result.current.archiveChapter();
    });

    let saved = 0;
    await act(async () => {
      saved = await result.current.confirmAndSave();
    });

    expect(saved).toBe(1);
    expect(argsOf("save_extracted_settings")?.novelId).toBe(1);
    expect(argsOf("save_extracted_settings")?.items).toEqual([
      { title: "雾隐峡", content: "峡谷两侧有灯塔", kind: "地理", tier: "short" },
    ]);
    expect(useArchiveStore.getState().candidates).toEqual([]); // 落库后清空
  });

  it("分级可在待确认队列中修正后入库", async () => {
    const { result } = renderHook(() => useArchiveChapter({ config, novelId: 1, chapterId: 5 }));
    await act(async () => {
      await result.current.archiveChapter();
    });

    act(() => {
      useArchiveStore
        .getState()
        .updateCandidate(1, { suggestedTier: "dark", content: "改写后内容" });
    });
    await act(async () => {
      await result.current.confirmAndSave();
    });

    expect(argsOf("save_extracted_settings")?.items).toEqual([
      { title: "雾隐峡", content: "改写后内容", kind: "地理", tier: "dark" },
    ]);
  });

  it("移除候选后不落库", async () => {
    const { result } = renderHook(() => useArchiveChapter({ config, novelId: 1, chapterId: 5 }));
    await act(async () => {
      await result.current.archiveChapter();
    });
    act(() => {
      useArchiveStore.getState().removeCandidate(1); // 移除 雾隐峡（唯一 new）
    });

    let saved = 0;
    await act(async () => {
      saved = await result.current.confirmAndSave();
    });
    expect(saved).toBe(0);
    expect(
      hoisted.invokeMock.mock.calls.some((call) => call[0] === "save_extracted_settings"),
    ).toBe(false);
  });

  it("抽取失败（收口异常）→ error 置位、候选保持空（失败不抛穿）", async () => {
    hoisted.failStream = true;
    const { result } = renderHook(() => useArchiveChapter({ config, novelId: 1, chapterId: 5 }));

    await act(async () => {
      await result.current.archiveChapter();
    });

    expect(result.current.error).toBeTruthy();
    expect(useArchiveStore.getState().candidates).toEqual([]);
  });

  it("无配置 / 未选章 → 不执行（零副作用）", async () => {
    const { result } = renderHook(() =>
      useArchiveChapter({ config: null, novelId: 1, chapterId: 5 }),
    );
    await act(async () => {
      await result.current.archiveChapter();
    });
    expect(hoisted.invokeMock.mock.calls.some((call) => call[0] === "get_chapter")).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { ModelConfig } from "@/domain/models/model-config";
import { IpcError } from "@/ipc/errors";
import type { Chunk } from "@/orchestration/types";
import { editorExtensions } from "@/features/editor/editor-extensions";
import { useGenerationStore } from "@/store/generationStore";
import { useGeneration } from "./useGeneration";

const { invokeMock, streamHolder } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  streamHolder: { fn: null as null | ((signal?: AbortSignal) => AsyncIterable<Chunk>) },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: (options: { signal?: AbortSignal }) => streamHolder.fn!(options.signal),
  }),
}));

const cfg: ModelConfig = {
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
  id: 1,
  volume_id: 1,
  title: "Ch1",
  content: "<p>前文</p>",
  content_format: "html",
  order_index: 0,
  status: "draft",
  created_at: "c",
  updated_at: "u",
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_setting_cards") return Promise.resolve([]);
    if (cmd === "get_chapter") return Promise.resolve(chapterRow);
    if (cmd === "list_chapters") return Promise.resolve([chapterRow]);
    return Promise.resolve([]);
  });
  useGenerationStore.getState().reset();
  streamHolder.fn = null;
});

const newEditor = () => new Editor({ extensions: editorExtensions, content: "" });
const START = { novelId: 1, chapterId: 1, userInstruction: "x", config: cfg };

describe("生成状态机（停止/失败/撤销/半态）", () => {
  it("停止 → 收敛 idle + requestId=null + 无悬挂 abort + 草稿保留", async () => {
    const editor = newEditor();
    streamHolder.fn = (signal) =>
      (async function* () {
        yield { delta: "A" };
        await delay(60);
        yield { delta: "B" };
        await new Promise<void>((resolve) => {
          if (signal?.aborted) return resolve();
          signal?.addEventListener("abort", () => resolve(), { once: true });
        });
      })();

    const { result } = renderHook(() => useGeneration(editor));
    let p!: Promise<void>;
    await act(async () => {
      p = result.current.start(START);
    });

    await waitFor(() => expect(useGenerationStore.getState().progress.chars).toBeGreaterThan(0));
    act(() => {
      result.current.stop();
    });
    await act(async () => {
      await p;
    });

    const st = useGenerationStore.getState();
    expect(st.status).not.toBe("streaming"); // 无半态
    expect(st.status).toBe("idle");
    expect(st.requestId).toBeNull();
    expect(result.current.abortRef.current).toBeNull(); // 无悬挂 abort 句柄
    expect(editor.getText()).toContain("A"); // 草稿保留
    editor.destroy();
  });

  it("失败 → 收敛 idle + error(IpcError) + requestId=null + 草稿保留", async () => {
    const editor = newEditor();
    streamHolder.fn = () =>
      (async function* () {
        yield { delta: "A" };
        await delay(60);
        yield { delta: "B" };
        throw new IpcError({ code: "TIMEOUT", message: "boom" });
      })();

    const { result } = renderHook(() => useGeneration(editor));
    await act(async () => {
      await result.current.start(START);
    });

    const st = useGenerationStore.getState();
    expect(st.status).not.toBe("streaming"); // 无半态
    expect(st.status).toBe("idle");
    expect(st.requestId).toBeNull();
    expect(st.error).toBeInstanceOf(IpcError);
    expect(st.error?.code).toBe("TIMEOUT");
    expect(editor.getText()).toContain("A"); // 草稿保留
    editor.destroy();
  });

  it("一次 undo() 撤销整段生成（依赖 newGroupDelay=5000）", async () => {
    const editor = newEditor();
    const before = editor.getHTML();
    streamHolder.fn = () =>
      (async function* () {
        for (let i = 0; i < 5; i += 1) yield { delta: "字" };
      })();

    const { result } = renderHook(() => useGeneration(editor));
    await act(async () => {
      await result.current.start(START);
    });

    expect(editor.getText()).toContain("字");
    editor.commands.undo();
    expect(editor.getHTML()).toBe(before); // 恢复到生成前
    editor.destroy();
  });
});

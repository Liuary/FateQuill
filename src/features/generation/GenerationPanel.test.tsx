import { Profiler, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import i18n from "@/app/i18n";
import type { Chunk } from "@/orchestration/types";
import { subscribeChunks } from "@/orchestration/stream";
import { editorExtensions } from "@/features/editor/editor-extensions";
import { createEditorController } from "@/features/editor/EditorController";
import { useEditorStore } from "@/store/editorStore";
import { useGenerationStore } from "@/store/generationStore";
import { GenerationPanel } from "./GenerationPanel";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

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
  invokeMock.mockReset();
  useGenerationStore.getState().reset();
  useEditorStore.setState({
    currentNovelId: null,
    currentChapterId: null,
    saveStatus: "saved",
    lastSavedAt: null,
  });
});

/** 模式 A 流式直插：subscribeChunks → appendChunk → flushPending */
async function streamInsert(editor: Editor, deltas: string[]) {
  const controller = createEditorController(editor);
  const source: AsyncIterable<Chunk> = (async function* () {
    for (const d of deltas) yield { delta: d };
  })();
  for await (const chunk of subscribeChunks(source)) controller.appendChunk(chunk.delta);
  controller.flushPending();
  controller.dispose();
}

function Harness({
  onReady,
  onRender,
}: {
  onReady: (e: Editor | null) => void;
  onRender: () => void;
}) {
  const editor = useEditor({ extensions: editorExtensions, content: "" });
  useEffect(() => {
    onReady(editor);
  }, [editor, onReady]);
  return (
    <Profiler id="editor" onRender={onRender}>
      <EditorContent editor={editor} />
    </Profiler>
  );
}

describe("C-03 / 代理指标（流式直插）", () => {
  it("流式期间编辑器 render=0 且 editorStore 快照（除自动保存域）不变", async () => {
    let editor: Editor | null = null;
    let renders = 0;
    render(
      <Harness
        onReady={(e) => {
          editor = e;
        }}
        onRender={() => {
          renders += 1;
        }}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });

    const renderBefore = renders;
    const storeBefore = useEditorStore.getState();
    await act(async () => {
      await streamInsert(
        editor!,
        Array.from({ length: 10 }, () => "字"),
      );
    });

    expect(renders - renderBefore).toBe(0); // 编辑器零 React 重渲染
    const storeAfter = useEditorStore.getState();
    // 除自动保存域（saveStatus/lastSavedAt）外不变
    expect(storeAfter.currentNovelId).toBe(storeBefore.currentNovelId);
    expect(storeAfter.currentChapterId).toBe(storeBefore.currentChapterId);
  });

  it("代理指标：dispatch ≤ chunk/2 且无 setContent 全量调用", async () => {
    let editor: Editor | null = null;
    render(
      <Harness
        onReady={(e) => {
          editor = e;
        }}
        onRender={() => {}}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    const dispatchSpy = vi.spyOn(editor!.view, "dispatch");
    const setContentSpy = vi.spyOn(editor!.commands, "setContent");
    const deltas = Array.from({ length: 10 }, () => "字");

    await act(async () => {
      await streamInsert(editor!, deltas);
    });

    expect(dispatchSpy.mock.calls.length).toBeLessThanOrEqual(deltas.length / 2);
    expect(setContentSpy).not.toHaveBeenCalled();
    expect(editor!.getText()).toContain("字");
  });
});

describe("GenerationPanel 可用性（Key 引导）", () => {
  it("无 model_config → 禁用 + 引导 Settings", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_model_configs") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    render(<GenerationPanel novelId={1} chapterId={1} editor={null} />);
    await waitFor(() => expect(screen.getByText(/前往「设置」/)).toBeInTheDocument());
    expect(screen.getByText("开始生成").closest("button")).toBeDisabled();
  });

  it("有 config 但无 Key → 禁用 + 引导", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
      if (cmd === "keyring_exists") return Promise.resolve(false);
      return Promise.resolve(undefined);
    });
    render(<GenerationPanel novelId={1} chapterId={1} editor={null} />);
    await waitFor(() => expect(screen.getByText(/前往「设置」/)).toBeInTheDocument());
    expect(screen.getByText("开始生成").closest("button")).toBeDisabled();
  });

  it("有 config 且 Key 存在 → 无引导（ready）", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
      if (cmd === "keyring_exists") return Promise.resolve(true);
      return Promise.resolve(undefined);
    });
    render(<GenerationPanel novelId={1} chapterId={1} editor={null} />);
    await waitFor(() => expect(screen.getByText("开始生成")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(/前往「设置」/)).toBeNull());
  });
});

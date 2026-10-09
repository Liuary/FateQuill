import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { editorExtensions } from "./editor-extensions";
import { useAutoSave } from "./useAutoSave";
import { useEditorStore } from "@/store/editorStore";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const META = { title: "T", status: "draft" as const, orderIndex: 0 };

/** update_chapter 的正常返回行（供 repositories.chapter.update 的映射） */
const OK_ROW = {
  id: 1,
  volume_id: 1,
  title: "T",
  content: "",
  content_format: "html",
  order_index: 0,
  status: "draft",
  created_at: "c",
  updated_at: "u",
};

function newEditor(html = "<p>初始</p>") {
  return new Editor({ extensions: editorExtensions, content: html });
}

beforeEach(() => {
  invokeMock.mockReset();
  useEditorStore.setState({ saveStatus: "saved", lastSavedAt: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutoSave", () => {
  it("① 编辑后立即 flush（不等待 800ms）→ update_chapter 收到最新 content", async () => {
    const calls: Array<{ id: number; content: string }> = [];
    invokeMock.mockImplementation((cmd: string, args: { id: number; content: string }) => {
      if (cmd === "update_chapter") calls.push({ id: args.id, content: args.content });
      return Promise.resolve(OK_ROW);
    });
    const editor = newEditor();
    const hook = renderHook(() => useAutoSave(editor, 1, META));

    act(() => {
      editor.commands.setContent("<p>新内容</p>");
    });
    await act(async () => {
      await hook.result.current.flush();
    });

    expect(calls.length).toBe(1);
    expect(calls[0].id).toBe(1);
    expect(calls[0].content).toContain("新内容");
    expect(useEditorStore.getState().saveStatus).toBe("saved");
    editor.destroy();
  });

  it("② 失败置脏 → 5s 重试成功清除", async () => {
    vi.useFakeTimers();
    let fail = true;
    let updateCalls = 0;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "update_chapter") {
        updateCalls += 1;
        return fail
          ? Promise.reject({ code: "DB_LOCKED", message: "locked" })
          : Promise.resolve(OK_ROW);
      }
      return Promise.resolve(OK_ROW);
    });
    const editor = newEditor();
    const hook = renderHook(() => useAutoSave(editor, 1, META));

    act(() => {
      editor.commands.setContent("<p>x</p>");
    });
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(useEditorStore.getState().saveStatus).toBe("dirty");

    fail = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(0);
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
    expect(updateCalls).toBe(2);
    expect(useEditorStore.getState().saveStatus).toBe("saved");
    editor.destroy();
  });

  it("③ 并发串行：in-flight 期间新变更 → 串行且最终写入最新 content", async () => {
    const calls: Array<{ content: string }> = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<unknown>((res) => {
      releaseFirst = () => res(OK_ROW);
    });
    invokeMock.mockImplementation((cmd: string, args: { content: string }) => {
      if (cmd === "update_chapter") {
        calls.push({ content: args.content });
        if (calls.length === 1) return firstGate; // 第一次挂起不 resolve
        return Promise.resolve(OK_ROW);
      }
      return Promise.resolve(OK_ROW);
    });
    const editor = newEditor();
    const hook = renderHook(() => useAutoSave(editor, 1, META));

    act(() => {
      editor.commands.setContent("<p>旧</p>");
    });
    let first!: Promise<boolean>;
    await act(async () => {
      first = hook.result.current.flush();
    });
    expect(calls.length).toBe(1);
    expect(calls[0].content).toContain("旧");

    // 第一次 in-flight 期间：编辑新内容并再次请求保存
    act(() => {
      editor.commands.setContent("<p>新</p>");
    });
    await act(async () => {
      void hook.result.current.saveNow();
    });
    expect(calls.length).toBe(1); // 第二次尚未发出（串行等待第一次）

    await act(async () => {
      releaseFirst();
      await first;
    });
    await act(async () => {
      await hook.result.current.flush();
    });

    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0].content).toContain("旧");
    expect(calls[calls.length - 1].content).toContain("新");
    editor.destroy();
  });
});

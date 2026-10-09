import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import i18n from "@/app/i18n";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { useEditorStore } from "@/store/editorStore";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const novelRow = { id: 1, title: "书一", synopsis: "", created_at: "c", updated_at: "u" };
const volRow = { id: 1, novel_id: 1, title: "卷一", order_index: 0 };
const chRow = (id: number, title: string, content: string) => ({
  id,
  volume_id: 1,
  title,
  content,
  content_format: "html",
  order_index: id - 1,
  status: "draft",
  created_at: "c",
  updated_at: "u",
});
const chapterContent = (id: number) => (id === 1 ? "<p>第一章内容</p>" : "<p>第二章内容</p>");

let updateCalls: Array<{ id: number; content: string }>;
let failUpdate: boolean;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  updateCalls = [];
  failUpdate = false;
  useEditorStore.setState({
    currentNovelId: null,
    currentChapterId: null,
    saveStatus: "saved",
    lastSavedAt: null,
  });
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string, args: { id?: number; content?: string }) => {
    if (cmd === "list_novels") return Promise.resolve([novelRow]);
    if (cmd === "list_volumes") return Promise.resolve([volRow]);
    if (cmd === "list_chapters")
      return Promise.resolve([
        chRow(1, "第1章", chapterContent(1)),
        chRow(2, "第2章", chapterContent(2)),
      ]);
    if (cmd === "get_chapter")
      return Promise.resolve(chRow(args.id ?? 1, `第${args.id}章`, chapterContent(args.id ?? 1)));
    if (cmd === "update_chapter") {
      updateCalls.push({ id: args.id ?? -1, content: args.content ?? "" });
      return failUpdate
        ? Promise.reject({ code: "DB_LOCKED", message: "locked" })
        : Promise.resolve(chRow(args.id ?? 1, "T", args.content ?? ""));
    }
    return Promise.resolve(undefined);
  });
});

/** 渲染工作区、选中第 1 章、编辑并返回当前编辑器 */
async function setupEditedChapter(editorRef: { current: Editor | null }) {
  render(
    <WorkspaceLayout
      onEditorReady={(e) => {
        editorRef.current = e;
      }}
    />,
  );
  await waitFor(() => expect(screen.getByText("第1章")).toBeInTheDocument());
  fireEvent.click(screen.getByText("第1章"));
  await waitFor(() => expect(document.body.textContent).toContain("第一章内容"));
  await waitFor(() => expect(editorRef.current).toBeTruthy());
  act(() => {
    editorRef.current!.commands.insertContent("新增片段");
  });
}

describe("chapter-switch-flush（BUG-001）", () => {
  it("编辑后 <800ms 内切章，前一章编辑不丢（flush 先落库）", async () => {
    const editorRef: { current: Editor | null } = { current: null };
    await setupEditedChapter(editorRef);

    // <800ms 内立即切章
    fireEvent.click(screen.getByText("第2章"));

    await waitFor(() =>
      expect(updateCalls.some((c) => c.id === 1 && c.content.includes("新增片段"))).toBe(true),
    );
    // 随后切换成功并加载第 2 章
    await waitFor(() => expect(useEditorStore.getState().currentChapterId).toBe(2));
    expect(document.body.textContent).toContain("第二章内容");
  });

  it("保存失败 → 阻断切章 + saveStatus='error'", async () => {
    failUpdate = true;
    const editorRef: { current: Editor | null } = { current: null };
    await setupEditedChapter(editorRef);

    fireEvent.click(screen.getByText("第2章"));

    await waitFor(() => expect(useEditorStore.getState().saveStatus).toBe("error"));
    expect(useEditorStore.getState().currentChapterId).toBe(1); // 未切章
  });
});

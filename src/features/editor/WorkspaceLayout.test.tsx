import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { useEditorStore } from "@/store/editorStore";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const novelRow = (id: number, title: string) => ({
  id,
  title,
  synopsis: "",
  created_at: "c",
  updated_at: "u",
});

let novels: unknown[];

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  novels = [novelRow(1, "书一")];
  useEditorStore.setState({
    currentNovelId: null,
    currentChapterId: null,
    saveStatus: "saved",
    lastSavedAt: null,
  });
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_novels") return Promise.resolve(novels);
    if (cmd === "list_volumes") return Promise.resolve([]);
    if (cmd === "list_chapters") return Promise.resolve([]);
    if (cmd === "create_novel") return Promise.resolve(novelRow(2, "新书"));
    return Promise.resolve(undefined);
  });
});

describe("WorkspaceLayout", () => {
  it("默认加载并选中首本书，渲染大纲树与编辑器", async () => {
    render(<WorkspaceLayout />);
    await waitFor(() => expect(useEditorStore.getState().currentNovelId).toBe(1));
    expect(screen.getByText("新增卷")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".ProseMirror")).toBeTruthy());
  });

  it("空态渲染新建入口，创建调用 create_novel 并 reload", async () => {
    novels = [];
    render(<WorkspaceLayout />);
    await waitFor(() => expect(screen.getByText("还没有作品，先创建一部吧")).toBeInTheDocument());

    const before = invokeMock.mock.calls.filter((c) => c[0] === "list_novels").length;
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "新书" } });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "create_novel")).toBe(true),
    );
    await waitFor(() => {
      const after = invokeMock.mock.calls.filter((c) => c[0] === "list_novels").length;
      expect(after).toBeGreaterThan(before);
    });
  });
});

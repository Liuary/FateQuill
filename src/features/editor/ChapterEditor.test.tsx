import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { ChapterEditor } from "./ChapterEditor";
import { editorExtensions } from "./editor-extensions";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const row = (id: number, title: string, content: string) => ({
  id,
  volume_id: 1,
  title,
  content,
  content_format: "html",
  order_index: id - 1,
  status: "draft",
  word_count: 6,
  created_at: "c",
  updated_at: "u",
});

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string, args: { id: number }) => {
    if (cmd === "get_chapter") {
      if (args.id === 1) return Promise.resolve(row(1, "C1", "<p>第一章内容</p>"));
      if (args.id === 2) return Promise.resolve(row(2, "C2", "<p>第二章内容</p>"));
    }
    return Promise.resolve(undefined);
  });
});

describe("ChapterEditor", () => {
  it("加载并渲染章节内容", async () => {
    const { container } = render(<ChapterEditor chapterId={1} />);
    await waitFor(() => expect(container.textContent).toContain("第一章内容"));
  });

  it("切换章节无串档，且连续切换后实例数=1", async () => {
    const { container, rerender } = render(<ChapterEditor chapterId={1} />);
    await waitFor(() => expect(container.textContent).toContain("第一章内容"));

    rerender(<ChapterEditor chapterId={2} />);
    await waitFor(() => expect(container.textContent).toContain("第二章内容"));
    expect(container.textContent).not.toContain("第一章内容");

    rerender(<ChapterEditor chapterId={1} />);
    await waitFor(() => expect(container.textContent).toContain("第一章内容"));
    rerender(<ChapterEditor chapterId={2} />);
    await waitFor(() => expect(container.textContent).toContain("第二章内容"));

    expect(container.querySelectorAll(".ProseMirror").length).toBe(1);
  });

  it("HTML 往返语义等价（setContent/getHTML）", () => {
    const editor = new Editor({ extensions: editorExtensions, content: "" });
    try {
      editor.commands.setContent("<p>往返内容</p>");
      const html = editor.getHTML();
      expect(html).toContain("<p>");
      expect(html).toContain("往返内容");
    } finally {
      editor.destroy();
    }
  });
});

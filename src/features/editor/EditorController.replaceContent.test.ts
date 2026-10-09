import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { editorExtensions } from "./editor-extensions";
import { createEditorController } from "./EditorController";

function newEditor(html = "") {
  return new Editor({ extensions: editorExtensions, content: html });
}

describe("EditorController.replaceContent（T3）", () => {
  it("整章替换：内容更新为给定 HTML", () => {
    const editor = newEditor("<p>旧正文</p>");
    const c = createEditorController(editor);
    c.replaceContent("<p>新正文</p><p>第二段</p>");
    expect(editor.getHTML()).toBe("<p>新正文</p><p>第二段</p>");
    c.dispose();
    editor.destroy();
  });

  it("单条撤销：一次 undo() 即恢复替换前内容", () => {
    const editor = newEditor("<p>旧正文</p>");
    const before = editor.getHTML();
    const c = createEditorController(editor);
    c.replaceContent("<p>重写后的正文</p>");
    expect(editor.getHTML()).toBe("<p>重写后的正文</p>");
    editor.commands.undo();
    expect(editor.getHTML()).toBe(before);
    c.dispose();
    editor.destroy();
  });

  it("替换前丢弃待插入缓冲（appendChunk 未 flush 不残留）", () => {
    const editor = newEditor("<p>旧正文</p>");
    const c = createEditorController(editor, { throttleMs: 10000 });
    c.appendChunk("未落盘的增量");
    c.replaceContent("<p>替换后</p>");
    c.flushPending();
    expect(editor.getHTML()).toBe("<p>替换后</p>");
    c.dispose();
    editor.destroy();
  });

  it("appendChunk 追加语义不变（替换后仍追加到文末）", () => {
    const editor = newEditor("<p>旧正文</p>");
    const c = createEditorController(editor, { throttleMs: 0 });
    c.replaceContent("<p>第一章</p>");
    c.appendChunk("后续增量");
    c.flushPending();
    expect(editor.getText().startsWith("第一章")).toBe(true);
    expect(editor.getText().trimEnd().endsWith("后续增量")).toBe(true); // 追加到文末，不覆盖替换内容
    c.dispose();
    editor.destroy();
  });
});

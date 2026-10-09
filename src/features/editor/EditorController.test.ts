import { describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { editorExtensions } from "./editor-extensions";
import { createEditorController } from "./EditorController";

function newEditor(html = "") {
  return new Editor({ extensions: editorExtensions, content: html });
}

describe("EditorController", () => {
  it("增量追加到文末（多 chunk 拼接）", () => {
    const editor = newEditor("<p>已有</p>");
    const c = createEditorController(editor, { throttleMs: 50 });
    c.appendChunk("你");
    c.appendChunk("好");
    c.flushPending();
    expect(editor.getText()).toContain("你好");
    expect(editor.getText().trimEnd().endsWith("你好")).toBe(true); // 落在文末
    editor.destroy();
  });

  it("节流合并：dispatch 次数 ≤ chunk 数", () => {
    const editor = newEditor("");
    const spy = vi.spyOn(editor.view, "dispatch");
    const c = createEditorController(editor, { throttleMs: 10000 });
    c.appendChunk("a");
    c.appendChunk("b");
    c.appendChunk("c");
    c.flushPending();
    expect(spy.mock.calls.length).toBeLessThanOrEqual(3);
    expect(spy.mock.calls.length).toBe(1);
    expect(editor.getText()).toContain("abc");
    editor.destroy();
  });

  it("撤销整段（REV-009）：一次 undo 恢复生成前文档且不误删会话前内容", () => {
    const editor = newEditor("<p>前置内容</p>");
    const before = editor.getHTML();
    const c = createEditorController(editor, { throttleMs: 0 });
    for (let i = 0; i < 5; i++) {
      c.appendChunk("生成");
      c.flushPending();
    }
    expect((editor.getText().match(/生成/g) ?? []).length).toBe(5);
    editor.commands.undo();
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it("IME 排队（REV-010）：composition 期间不入档，compositionend 后 flush", () => {
    const editor = newEditor("");
    const c = createEditorController(editor, { throttleMs: 0 });
    const dom = editor.view.dom;
    dom.dispatchEvent(new CompositionEvent("compositionstart"));
    c.appendChunk("中文");
    c.flushPending();
    expect(editor.getText()).not.toContain("中文");
    dom.dispatchEvent(new CompositionEvent("compositionend"));
    expect(editor.getText()).toContain("中文");
    editor.destroy();
  });

  it("dispose：移除 DOM composition 监听", () => {
    const editor = newEditor("");
    const c = createEditorController(editor, { throttleMs: 0 });
    c.dispose();
    const dom = editor.view.dom;
    dom.dispatchEvent(new CompositionEvent("compositionstart"));
    c.appendChunk("x");
    c.flushPending();
    expect(editor.getText()).toContain("x"); // 不再受 composition 影响
    editor.destroy();
  });
});

import { describe, expect, it } from "vitest";
import { useEditorStore } from "./editorStore";

describe("editorStore 边界（单一事实源）", () => {
  it("state 不含文档正文字段（内容在 Tiptap 实例）", () => {
    const keys = Object.keys(useEditorStore.getState());
    expect(keys).not.toContain("content");
    expect(keys).not.toContain("html");
    expect(keys).not.toContain("doc");
  });

  it("state 含预期元字段", () => {
    const keys = Object.keys(useEditorStore.getState());
    expect(keys).toEqual(
      expect.arrayContaining(["currentNovelId", "currentChapterId", "saveStatus", "lastSavedAt"]),
    );
  });
});

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { editorExtensions } from "./editor-extensions";

const EXPECTED_EXTENSIONS = [
  "bold",
  "italic",
  "strike",
  "underline",
  "link",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "code",
  "codeBlock",
  "horizontalRule",
  "undoRedo",
  "markdown",
];

describe("editorExtensions", () => {
  it("扩展清单含 14 项预期扩展", () => {
    const editor = new Editor({ extensions: editorExtensions });
    try {
      const names = editor.extensionManager.extensions.map((e) => e.name);
      const missing = EXPECTED_EXTENSIONS.filter((n) => !names.includes(n));
      expect(missing, `existing extensions: ${names.join(",")}`).toEqual([]);
      expect(EXPECTED_EXTENSIONS).toHaveLength(14);
    } finally {
      editor.destroy();
    }
  });

  it("getHTML 可序列化（setContent 后含 <p>）", () => {
    const editor = new Editor({ extensions: editorExtensions, content: "" });
    try {
      editor.commands.setContent("<p>你好</p>");
      expect(editor.getHTML()).toContain("<p>");
    } finally {
      editor.destroy();
    }
  });
});

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { editorExtensions } from "./editor-extensions";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

/** 解析 Markdown 为 JSON（用于语义等价断言，而非字符串全等） */
function jsonOf(markdown: string): JSONContent {
  const editor = new Editor({ extensions: editorExtensions, content: "" });
  try {
    editor.commands.setContent(markdown, { contentType: "markdown" });
    return editor.getJSON();
  } finally {
    editor.destroy();
  }
}

/** 一次往返：md → html → md */
function roundtrip(markdown: string): string {
  return htmlToMarkdown(markdownToHtml(markdown));
}

const CASES: Array<{ name: string; md: string }> = [
  { name: "h1", md: "# 标题一" },
  { name: "h2", md: "## 标题二" },
  { name: "h3", md: "### 标题三" },
  { name: "bold", md: "**粗体**" },
  { name: "italic", md: "*斜体*" },
  { name: "strike", md: "~~删除~~" },
  { name: "bulletList", md: "- 甲\n- 乙" },
  { name: "orderedList", md: "1. 甲\n2. 乙" },
  { name: "blockquote", md: "> 引用" },
  { name: "inlineCode", md: "`代码`" },
  { name: "codeBlock", md: "```\n代码块\n```" },
  { name: "horizontalRule", md: "---" },
  { name: "link", md: "[链接](https://example.com)" },
];

describe("markdown roundtrip", () => {
  expect(CASES.length).toBeGreaterThanOrEqual(8);

  for (const c of CASES) {
    it(`往返语义等价（JSON 幂等）：${c.name}`, () => {
      const md2 = roundtrip(c.md);
      expect(jsonOf(md2)).toEqual(jsonOf(c.md));
    });
  }

  it("htmlToMarkdown 输出 Markdown 语法", () => {
    const md = htmlToMarkdown("<h1>标题</h1><p><strong>粗</strong></p>");
    expect(md).toContain("# 标题");
    expect(md).toContain("**粗**");
  });

  it("markdownToHtml 生成对应 HTML 标签", () => {
    expect(markdownToHtml("# 标题一")).toContain("<h1>");
    expect(markdownToHtml("**粗体**")).toContain("<strong>");
    expect(markdownToHtml("> 引用")).toContain("<blockquote>");
  });
});

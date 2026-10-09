import { Editor } from "@tiptap/core";
import { editorExtensions } from "./editor-extensions";

/** Markdown → HTML（经 Tiptap 解析，用于导入） */
export function markdownToHtml(markdown: string): string {
  const editor = new Editor({ extensions: editorExtensions, content: "" });
  editor.commands.setContent(markdown, { contentType: "markdown" });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

/** HTML → Markdown（经 Tiptap 序列化，用于导出） */
export function htmlToMarkdown(html: string): string {
  const editor = new Editor({ extensions: editorExtensions, content: html });
  const md = editor.getMarkdown();
  editor.destroy();
  return md;
}

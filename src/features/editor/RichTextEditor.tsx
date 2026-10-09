import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { editorExtensions } from "./editor-extensions";

export interface RichTextEditorProps {
  content?: string; // HTML（content_format='html'）
  editable?: boolean;
  onUpdate?: (html: string) => void; // 每次文档变更回传 getHTML()
  onReady?: (editor: Editor | null) => void;
}

/** 基础富文本编辑区（T1）：HTML 入 / getHTML() 出；一章一实例由上层（T2）负责销毁/重建 */
export function RichTextEditor({
  content = "",
  editable = true,
  onUpdate,
  onReady,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: editorExtensions,
    content,
    editable,
    onUpdate: ({ editor }) => onUpdate?.(editor.getHTML()),
    editorProps: { attributes: { class: "tiptap-editor prose max-w-none focus:outline-none" } },
  });
  // onReady 放入 effect（避免渲染期副作用 / 每渲染重复触发；REV-012②）
  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}

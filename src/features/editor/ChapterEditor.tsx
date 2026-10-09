import { useEffect, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { RichTextEditor } from "./RichTextEditor";
import { useChapter } from "./useChapter";
import { useEditorStore } from "@/store/editorStore";

export interface ChapterEditorProps {
  chapterId: number | null;
  editable?: boolean;
  onEditorReady?: (editor: Editor | null) => void; // 供 T5/T8 接线
}

/** 章节编辑器：按 chapterId 重挂载 Tiptap 实例（key），保证「一章一实例、无串档」 */
export function ChapterEditor({ chapterId, editable = true, onEditorReady }: ChapterEditorProps) {
  const { chapter, loading } = useChapter(chapterId);
  const setCurrentChapter = useEditorStore((s) => s.setCurrentChapter);
  useEffect(() => {
    setCurrentChapter(chapterId);
  }, [chapterId, setCurrentChapter]);

  const key = chapterId ?? -1;
  const content = useMemo(() => chapter?.content ?? "", [chapter]);
  // 仅在「已加载章节与当前 id 匹配」时挂载编辑器，避免切换窗口内以旧内容初始化（无串档）
  if (loading || (chapterId != null && chapter?.id !== chapterId)) {
    return <div className="p-4 text-sm opacity-60">…</div>;
  }
  return <RichTextEditor key={key} content={content} editable={editable} onReady={onEditorReady} />;
}

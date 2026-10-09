import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { RichTextEditor } from "./RichTextEditor";
import { EditorStatusBadge } from "./EditorStatusBadge";
import { useChapter } from "./useChapter";
import { useAutoSave, useFlushOnClose, type AutoSaveMeta } from "./useAutoSave";
import { useEditorStore } from "@/store/editorStore";

export interface ChapterEditorProps {
  chapterId: number | null;
  editable?: boolean;
  onEditorReady?: (editor: Editor | null) => void; // 供 T5/T8 接线
  /** 暴露 flush：父层在切换 chapterId 前须 `await flush()`（保证切章前存盘） */
  onFlushReady?: (flush: () => Promise<void>) => void;
}

/** 章节编辑器：按 chapterId 重挂载 Tiptap 实例（key），保证「一章一实例、无串档」；接入自动保存 */
export function ChapterEditor({
  chapterId,
  editable = true,
  onEditorReady,
  onFlushReady,
}: ChapterEditorProps) {
  const { chapter, loading } = useChapter(chapterId);
  const setCurrentChapter = useEditorStore((s) => s.setCurrentChapter);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    setCurrentChapter(chapterId);
  }, [chapterId, setCurrentChapter]);

  const meta = useMemo<AutoSaveMeta>(
    () => ({
      title: chapter?.title ?? "",
      status: chapter?.status ?? "draft",
      orderIndex: chapter?.orderIndex ?? 0,
    }),
    [chapter],
  );

  const { flush } = useAutoSave(editor, chapterId, meta);
  useFlushOnClose();

  useEffect(() => {
    onFlushReady?.(flush);
  }, [onFlushReady, flush]);

  function handleReady(e: Editor | null) {
    setEditor(e);
    onEditorReady?.(e);
  }

  const key = chapterId ?? -1;
  const content = useMemo(() => chapter?.content ?? "", [chapter]);
  // 仅在「已加载章节与当前 id 匹配」时挂载编辑器，避免切换窗口内以旧内容初始化（无串档）
  if (loading || (chapterId != null && chapter?.id !== chapterId)) {
    return <div className="p-4 text-sm opacity-60">…</div>;
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-end px-2">
        <EditorStatusBadge />
      </div>
      <RichTextEditor key={key} content={content} editable={editable} onReady={handleReady} />
    </div>
  );
}

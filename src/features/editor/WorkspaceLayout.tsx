import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useNovels } from "./useNovels";
import { OutlineTree } from "./OutlineTree";
import { ChapterEditor } from "./ChapterEditor";
import { NewNovelPanel } from "./NewNovelPanel";

/** 工作区：左大纲树 + 右编辑器（grid 预留第三栏，供 stage-05 生成面板） */
export function WorkspaceLayout() {
  const { novels, loading, createNovel } = useNovels();
  // 分项选择器订阅（避免全量解构导致保存状态翻转时整布局重渲染；REV-012①）
  const currentNovelId = useEditorStore((s) => s.currentNovelId);
  const currentChapterId = useEditorStore((s) => s.currentChapterId);
  const setCurrentNovel = useEditorStore((s) => s.setCurrentNovel);

  useEffect(() => {
    // 默认书：首个
    if (currentNovelId == null && novels.length > 0) {
      setCurrentNovel(novels[0].id);
    }
  }, [novels, currentNovelId, setCurrentNovel]);

  if (loading) return <div className="p-6 text-sm opacity-60">…</div>;
  if (novels.length === 0) return <NewNovelPanel onCreate={createNovel} />;

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_minmax(0,0fr)]">
      <aside className="border-border overflow-auto border-r">
        <OutlineTree novelId={currentNovelId} />
      </aside>
      <section className="overflow-auto">
        <ChapterEditor chapterId={currentChapterId} />
      </section>
      {/* 第三栏预留（stage-05 生成面板） */}
    </div>
  );
}

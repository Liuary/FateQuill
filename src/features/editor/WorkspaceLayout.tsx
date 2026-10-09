import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { useEditorStore } from "@/store/editorStore";
import { GenerationPanel } from "@/features/generation/GenerationPanel";
import { SettingCardsPanel } from "@/features/setting-cards/SettingCardsPanel";
import { useNovels } from "./useNovels";
import { OutlineTree } from "./OutlineTree";
import { ChapterEditor } from "./ChapterEditor";
import { NewNovelPanel } from "./NewNovelPanel";

export interface WorkspaceLayoutProps {
  /** 测试/上层接线：捕获当前编辑器实例（可选） */
  onEditorReady?: (editor: Editor | null) => void;
}

/** 工作区：左大纲树 + 中编辑器 + 右生成面板（grid 三栏，第三栏 stage-05 兑现） */
export function WorkspaceLayout({ onEditorReady }: WorkspaceLayoutProps = {}) {
  const { novels, loading, createNovel } = useNovels();
  // 分项选择器订阅（避免全量解构导致保存状态翻转时整布局重渲染；REV-012①）
  const currentNovelId = useEditorStore((s) => s.currentNovelId);
  const currentChapterId = useEditorStore((s) => s.currentChapterId);
  const setCurrentNovel = useEditorStore((s) => s.setCurrentNovel);
  const setCurrentChapter = useEditorStore((s) => s.setCurrentChapter);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tab, setTab] = useState<"generation" | "settingCards">("generation");
  const { t } = useTranslation();
  // 指向「当前渲染的 ChapterEditor 的 flush」，其闭包绑定当前 chapterId/editor
  const flushRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  useEffect(() => {
    // 默认书：首个
    if (currentNovelId == null && novels.length > 0) {
      setCurrentNovel(novels[0].id);
    }
  }, [novels, currentNovelId, setCurrentNovel]);

  /** 唯一合法切章入口：先 flush 旧章，成功才切；失败阻断并提示（BUG-001 修复核心） */
  const requestSelectChapter = useCallback(
    async (id: number) => {
      if (id === currentChapterId) return;
      const ok = await flushRef.current(); // 旧实例销毁前同步 flush
      if (!ok) {
        setSaveStatus("error"); // 落库失败：阻断切章（重试成功后用户可再切）
        return;
      }
      setCurrentChapter(id);
    },
    [currentChapterId, setCurrentChapter, setSaveStatus],
  );

  if (loading) return <div className="p-6 text-sm opacity-60">…</div>;
  if (novels.length === 0) return <NewNovelPanel onCreate={createNovel} />;

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_minmax(0,320fr)]">
      <aside className="border-border overflow-auto border-r">
        <OutlineTree
          novelId={currentNovelId}
          selectedChapterId={currentChapterId}
          onSelectChapter={requestSelectChapter}
          flush={() => flushRef.current()}
        />
      </aside>
      <section className="overflow-auto">
        <ChapterEditor
          chapterId={currentChapterId}
          onEditorReady={(e) => {
            setEditor(e);
            onEditorReady?.(e);
          }}
          onFlushReady={(f) => {
            flushRef.current = f;
          }}
        />
      </section>
      <aside className="border-border overflow-auto border-l">
        <div className="border-border flex gap-2 border-b p-1 text-sm">
          <button
            type="button"
            className={tab === "generation" ? "font-medium" : "opacity-70"}
            onClick={() => setTab("generation")}
          >
            {t("generation:tabGeneration")}
          </button>
          <button
            type="button"
            className={tab === "settingCards" ? "font-medium" : "opacity-70"}
            onClick={() => setTab("settingCards")}
          >
            {t("settingCards:tab")}
          </button>
        </div>
        {tab === "generation" ? (
          <GenerationPanel novelId={currentNovelId} chapterId={currentChapterId} editor={editor} />
        ) : (
          <SettingCardsPanel novelId={currentNovelId} />
        )}
      </aside>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { useEditorStore } from "@/store/editorStore";
import { GenerationPanel } from "@/features/generation/GenerationPanel";
import { SettingCardsPanel } from "@/features/setting-cards/SettingCardsPanel";
import { ReviewPanel } from "@/features/review/ReviewPanel";
import { ExplorationPanel } from "@/features/exploration/ExplorationPanel";
import { DialoguePanel } from "@/features/dialogue/DialoguePanel";
import { CharactersPanel } from "@/features/characters/CharactersPanel";
import { ConsistencyPanel } from "@/features/consistency/ConsistencyPanel";
import { ArchivePanel } from "@/features/consistency/ArchivePanel";
import { AutopilotPanel } from "@/features/autopilot/AutopilotPanel";
import { useConsistencyFocusStore } from "@/store/consistencyStore";
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
  const [tab, setTab] = useState<
    | "generation"
    | "settingCards"
    | "review"
    | "exploration"
    | "dialogue"
    | "characters"
    | "consistency"
    | "autopilot"
  >("generation");
  const focusCard = useConsistencyFocusStore((s) => s.focus);
  const clearFocus = useConsistencyFocusStore((s) => s.clearFocus);
  // 冲突处置「编辑设定卡」：定位请求存在时第三栏**优先**展示设定卡面板（派生，避免 effect 内 setState）
  const activeTab = focusCard ? "settingCards" : tab;
  /** 用户主动切 tab：清掉定位请求，回到常规 tab 状态 */
  const selectTab = (next: typeof tab) => {
    clearFocus();
    setTab(next);
  };
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
            className={activeTab === "generation" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("generation")}
          >
            {t("generation:tabGeneration")}
          </button>
          <button
            type="button"
            className={activeTab === "settingCards" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("settingCards")}
          >
            {t("settingCards:tab")}
          </button>
          <button
            type="button"
            className={activeTab === "review" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("review")}
          >
            {t("review:tab")}
          </button>
          <button
            type="button"
            className={activeTab === "exploration" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("exploration")}
          >
            {t("exploration:tab")}
          </button>
          <button
            type="button"
            className={activeTab === "dialogue" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("dialogue")}
          >
            {t("dialogue:tab")}
          </button>
          <button
            type="button"
            className={activeTab === "characters" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("characters")}
          >
            {t("characters:tab")}
          </button>
          <button
            type="button"
            className={activeTab === "consistency" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("consistency")}
          >
            {t("consistency:tab")}
          </button>
          <button
            type="button"
            className={activeTab === "autopilot" ? "font-medium" : "opacity-70"}
            onClick={() => selectTab("autopilot")}
          >
            {t("autopilot:tab", { defaultValue: "全自动" })}
          </button>
        </div>
        {activeTab === "generation" ? (
          <GenerationPanel novelId={currentNovelId} chapterId={currentChapterId} editor={editor} />
        ) : activeTab === "settingCards" ? (
          <SettingCardsPanel novelId={currentNovelId} />
        ) : activeTab === "review" ? (
          <ReviewPanel novelId={currentNovelId} chapterId={currentChapterId} editor={editor} />
        ) : activeTab === "exploration" ? (
          <ExplorationPanel novelId={currentNovelId} chapterId={currentChapterId} editor={editor} />
        ) : activeTab === "dialogue" ? (
          <DialoguePanel novelId={currentNovelId} chapterId={currentChapterId} editor={editor} />
        ) : activeTab === "characters" ? (
          <CharactersPanel novelId={currentNovelId} />
        ) : activeTab === "consistency" ? (
          // 「一致性」tab **双区**：归档区（上）+ 冲突区（下）——两面板均生产可达（BUG-001 修复）
          <div data-testid="consistency-tab" className="flex flex-col">
            <ArchivePanel novelId={currentNovelId} chapterId={currentChapterId} />
            <ConsistencyPanel novelId={currentNovelId} />
          </div>
        ) : (
          // 「全自动」tab（stage-12 T2）：无人值守链路入口（生产可达）
          <AutopilotPanel novelId={currentNovelId} chapterId={currentChapterId} />
        )}
      </aside>
    </div>
  );
}

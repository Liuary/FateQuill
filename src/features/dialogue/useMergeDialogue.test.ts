import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import i18n from "@/app/i18n";
import { editorExtensions } from "@/features/editor/editor-extensions";
import { useDialogueStore } from "@/store/dialogueStore";
import { useReviewStore } from "@/store/reviewStore";
import { useMergeDialogue } from "./useMergeDialogue";

const hoisted = vi.hoisted(() => ({ invokeMock: vi.fn(), calls: [] as string[] }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
// 记录替换调用（与快照顺序断言共用 calls）
vi.mock("@/features/editor/EditorController", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/EditorController")>();
  return {
    createEditorController: (editor: Editor) => {
      const controller = actual.createEditorController(editor);
      return {
        ...controller,
        replaceContent: (html: string) => {
          hoisted.calls.push("replaceContent");
          return controller.replaceContent(html);
        },
      };
    },
  };
});

const chapterRow = {
  id: 5,
  volume_id: 3,
  title: "第五章",
  content: "<p>原正文</p>",
  content_format: "html",
  order_index: 0,
  status: "draft",
  word_count: 4,
  created_at: "c",
  updated_at: "u",
};

const argsOf = (cmd: string) =>
  hoisted.invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as
    Record<string, unknown> | undefined;

const ENTRY_HTML =
  '<p class="narration">雾散。</p><p class="dialogue"><strong>林砚</strong>：走吧。</p>';

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "get_chapter") return Promise.resolve(chapterRow);
    if (cmd === "list_chapters") return Promise.resolve([chapterRow]);
    if (cmd === "create_chapter") return Promise.resolve({ ...chapterRow, id: 6 });
    return Promise.resolve(undefined);
  });
  hoisted.calls.length = 0;
  useDialogueStore.setState({
    entries: [
      { id: "a", kind: "narration", content: "雾散。", orderIndex: 0 },
      {
        id: "b",
        kind: "dialogue",
        speakerId: 1,
        speakerName: "林砚",
        content: "走吧。",
        orderIndex: 1,
      },
    ],
    running: false,
  });
  useReviewStore.setState({
    versions: [],
    weights: { plot: 1, worldview: 1, compliance: 1, humanity: 1 },
    activeVersionId: null,
    autoRewrite: true,
    maxRounds: 2,
    needsHumanReview: false,
  });
});

describe("useMergeDialogue（双路径落章）", () => {
  it("主路径：chapter.create（追加卷末）+ 拼接内容；**当前章无 update**", async () => {
    const { result } = renderHook(() => useMergeDialogue(null));

    await act(async () => {
      await result.current.mergeAsNextChapter(5);
    });

    expect(argsOf("create_chapter")?.volumeId).toBe(3);
    expect(argsOf("create_chapter")?.content).toBe(ENTRY_HTML);
    expect(argsOf("create_chapter")?.contentFormat).toBe("html");
    expect(argsOf("create_chapter")?.orderIndex).toBe(1); // 卷末
    // 防丢失：当前章 DB 行未被覆盖
    expect(hoisted.invokeMock.mock.calls.some((call) => call[0] === "update_chapter")).toBe(false);
    // 会话条目保留（不自动清空）
    expect(useDialogueStore.getState().entries).toHaveLength(2);
  });

  it("次路径：**先强制快照后替换**（顺序断言）+ 单次 replaceContent + 单次 undo 恢复", () => {
    const editor = new Editor({ extensions: editorExtensions, content: "<p>原正文</p>" });
    const before = editor.getHTML();
    const { result } = renderHook(() => useMergeDialogue(editor));

    const originalAddVersion = useReviewStore.getState().addVersion;
    const addVersionSpy = vi
      .spyOn(useReviewStore.getState(), "addVersion")
      .mockImplementation((version) => {
        hoisted.calls.push("addVersion");
        originalAddVersion(version);
      });

    let ok = false;
    act(() => {
      ok = result.current.replaceCurrentChapter(5, editor.getHTML());
    });
    addVersionSpy.mockRestore();

    expect(ok).toBe(true);
    // 顺序：快照先于替换（安全网必做）
    expect(hoisted.calls).toEqual(["addVersion", "replaceContent"]);
    // 快照记录替换前正文
    const versions = useReviewStore.getState().versions;
    expect(versions).toHaveLength(1);
    expect(versions[0].label).toBe("dialogue-merge-safety");
    expect(versions[0].content).toBe(before);
    // 正文已替换（单条撤销历史）
    expect(editor.getHTML()).toContain("雾散。");
    expect(editor.getHTML()).toContain("林砚");
    // 一次 undo 恢复替换前正文
    editor.commands.undo();
    expect(editor.getHTML()).toBe(before);

    editor.destroy();
  });

  it("次路径：未绑定编辑器 / 未选章 → 不执行（零副作用）", () => {
    const { result } = renderHook(() => useMergeDialogue(null));
    expect(result.current.replaceCurrentChapter(5, "<p>x</p>")).toBe(false);
    expect(hoisted.calls).toEqual([]);
    expect(useReviewStore.getState().versions).toHaveLength(0);
  });
});

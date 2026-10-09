import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import i18n from "@/app/i18n";
import { editorExtensions } from "@/features/editor/editor-extensions";
import { useExplorationStore } from "@/store/explorationStore";
import { useReviewStore } from "@/store/reviewStore";
import { BranchCard } from "./BranchCard";
import { useAdoptBranch } from "./useAdoptBranch";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

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

const branch = {
  id: "b0",
  temperature: 0.7,
  effectiveTemperature: 0.7,
  clamped: false,
  status: "done" as const,
  card: { summary: "走向：北上结盟", keyTurns: ["渡口遇袭"], settingCardIds: [1] },
};

const diff = { branchId: "b0", uniqueKeyTurns: ["渡口遇袭"], sharedKeyTurns: [] };

/** 调用参数 */
const argsOf = (cmd: string) =>
  invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as Record<string, unknown> | undefined;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "get_chapter") return Promise.resolve(chapterRow);
    if (cmd === "list_chapters") return Promise.resolve([chapterRow]);
    if (cmd === "create_chapter")
      return Promise.resolve({ ...chapterRow, id: 6, title: "推演草稿" });
    return Promise.resolve(undefined);
  });
  useExplorationStore.setState({
    intent: "",
    temperatures: [0.7],
    branches: [branch],
    running: false,
    selectedBranchId: null,
    collapsedIds: [],
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

describe("useAdoptBranch（双路径 + 防丢失安全网）", () => {
  it("① 主路径 DB 安全：新建下一章（内容含走向卡）；**不调用 chapter.update**", async () => {
    const { result } = renderHook(() => useAdoptBranch(null));

    await act(async () => {
      await result.current.adoptAsNextChapter("b0", 5);
    });

    expect(invokeMock).toHaveBeenCalledWith("create_chapter", expect.anything());
    expect(argsOf("create_chapter")?.volumeId).toBe(3);
    expect(String(argsOf("create_chapter")?.content)).toContain("走向：北上结盟");
    expect(argsOf("create_chapter")?.orderIndex).toBe(1); // 追加卷末
    // 防丢失：当前章 DB 行未被覆盖
    expect(invokeMock.mock.calls.some((call) => call[0] === "update_chapter")).toBe(false);
  });

  it("② 次路径安全网（必做）：替换前正文入池快照 + 单次 undo 恢复", async () => {
    const editor = new Editor({ extensions: editorExtensions, content: "<p>原正文</p>" });
    const before = editor.getHTML();
    const { result } = renderHook(() => useAdoptBranch(editor));

    let replaced = false;
    act(() => {
      replaced = result.current.replaceCurrentChapter("b0", editor.getHTML());
    });

    expect(replaced).toBe(true);
    // 强制安全网：替换前正文入版本池（会话内可恢复）
    const versions = useReviewStore.getState().versions;
    expect(versions.some((v) => v.content === before && v.label === "adopt-safety")).toBe(true);
    // 正文已替换
    expect(editor.getHTML()).toContain("走向：北上结盟");
    // 单条撤销恢复替换前正文
    editor.commands.undo();
    expect(editor.getHTML()).toBe(before);

    editor.destroy();
  });

  it("③ 确认门：未确认（取消）→ 两路径均零副作用；确认后才执行", async () => {
    const editor = new Editor({ extensions: editorExtensions, content: "<p>原正文</p>" });
    const hook = renderHook(() => useAdoptBranch(editor));

    function Harness() {
      return createElement(BranchCard, {
        branch,
        diff,
        collapsed: false,
        selected: false,
        onToggleCollapsed: () => {},
        onSelect: () => {},
        onAdoptNextChapter: (id: string) => hook.result.current.adoptAsNextChapter(id, 5),
        onReplaceCurrent: (id: string) =>
          hook.result.current.replaceCurrentChapter(id, editor.getHTML()),
        onDiscard: hook.result.current.discard,
      });
    }
    render(createElement(Harness));

    const card = screen.getByTestId("branch-card");

    // 取消「采纳为下一章」→ 无 create_chapter
    fireEvent.click(within(card).getByRole("button", { name: "采纳为下一章" }));
    fireEvent.click(within(card).getByRole("button", { name: "取消" }));
    expect(invokeMock.mock.calls.some((call) => call[0] === "create_chapter")).toBe(false);

    // 取消「替换当前章」→ 无快照、无替换
    fireEvent.click(within(card).getByRole("button", { name: "替换当前章（危险）" }));
    fireEvent.click(within(card).getByRole("button", { name: "取消" }));
    expect(useReviewStore.getState().versions).toHaveLength(0);
    expect(editor.getHTML()).toBe("<p>原正文</p>");

    // 确认「替换当前章」→ 快照 + 替换
    fireEvent.click(within(card).getByRole("button", { name: "替换当前章（危险）" }));
    fireEvent.click(within(card).getByRole("button", { name: "确认" }));
    await waitFor(() => expect(useReviewStore.getState().versions).toHaveLength(1));
    expect(editor.getHTML()).toContain("走向：北上结盟");

    editor.destroy();
  });

  it("④ 丢弃无残留：分支移除且选中态清空", () => {
    useExplorationStore.setState({ selectedBranchId: "b0" });
    const { result } = renderHook(() => useAdoptBranch(null));

    act(() => {
      result.current.discard("b0");
    });

    const state = useExplorationStore.getState();
    expect(state.branches.find((item) => item.id === "b0")).toBeUndefined();
    expect(state.selectedBranchId).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { PREVIOUS_TAIL_LIMIT, useSceneContext } from "./scene-context";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const settingCardRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  novel_id: 1,
  title: "世界观",
  content: "潮汐随月相起落",
  ...over,
});

const chapterRow = (over: Record<string, unknown> = {}) => ({
  id: 5,
  volume_id: 3,
  title: "第五章",
  content: "",
  content_format: "html",
  order_index: 1,
  status: "draft",
  word_count: 0,
  created_at: "c",
  updated_at: "u",
  ...over,
});

const calls = (cmd: string) => invokeMock.mock.calls.filter((call) => call[0] === cmd).length;

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_setting_cards") return Promise.resolve([settingCardRow()]);
    if (cmd === "get_chapter") return Promise.resolve(chapterRow());
    if (cmd === "list_chapters") {
      return Promise.resolve([
        chapterRow({ id: 4, order_index: 0, content: "<p>前一章<b>正文</b>片段</p>" }),
        chapterRow({ id: 5, order_index: 1, content: "<p>当前章</p>" }),
      ]);
    }
    return Promise.resolve(undefined);
  });
});

describe("useSceneContext（场景上下文装载，BUG-001）", () => {
  it("装载设定卡（仅本作品）+ 前章末尾（同卷排序 + **去 HTML 标签**）", async () => {
    const { result } = renderHook(() => useSceneContext({ novelId: 1, chapterId: 5 }));

    await waitFor(() => expect(result.current.settingCards).toHaveLength(1));
    expect(result.current.settingCards[0]).toEqual({ title: "世界观", content: "潮汐随月相起落" });
    // 前章末尾：取前一章（orderIndex 0）content 去标签文本
    await waitFor(() => expect(result.current.previousChapterTail).toBe("前一章正文片段"));
  });

  it("无前章（当前章为同卷首章）→ 空串", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_setting_cards") return Promise.resolve([]);
      if (cmd === "get_chapter") return Promise.resolve(chapterRow({ id: 4, order_index: 0 }));
      if (cmd === "list_chapters") {
        return Promise.resolve([chapterRow({ id: 4, order_index: 0, content: "<p>首章</p>" })]);
      }
      return Promise.resolve(undefined);
    });
    const { result } = renderHook(() => useSceneContext({ novelId: 1, chapterId: 4 }));
    await waitFor(() => expect(calls("list_chapters")).toBeGreaterThan(0));
    expect(result.current.previousChapterTail).toBe("");
  });

  it("未选章（chapterId=null）→ 空串且**不发起章节 IPC**", async () => {
    const { result } = renderHook(() => useSceneContext({ novelId: 1, chapterId: null }));
    await waitFor(() => expect(calls("list_setting_cards")).toBeGreaterThan(0));
    expect(result.current.previousChapterTail).toBe("");
    expect(calls("get_chapter")).toBe(0);
    expect(calls("list_chapters")).toBe(0);
  });

  it("`setSceneInstruction` 生效（会话态）", async () => {
    const { result } = renderHook(() => useSceneContext({ novelId: 1, chapterId: null }));
    act(() => result.current.setSceneInstruction("雨夜破庙"));
    expect(result.current.sceneInstruction).toBe("雨夜破庙");
  });

  it("超长前章 → 取末尾（限长 = stage-05 `PROMPT_BUDGET.prevTail`）", async () => {
    const long = "甲".repeat(PREVIOUS_TAIL_LIMIT + 300);
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_setting_cards") return Promise.resolve([]);
      if (cmd === "get_chapter") return Promise.resolve(chapterRow());
      if (cmd === "list_chapters") {
        return Promise.resolve([
          chapterRow({ id: 4, order_index: 0, content: long }),
          chapterRow({ id: 5, order_index: 1 }),
        ]);
      }
      return Promise.resolve(undefined);
    });
    const { result } = renderHook(() => useSceneContext({ novelId: 1, chapterId: 5 }));
    await waitFor(() =>
      expect(result.current.previousChapterTail).toHaveLength(PREVIOUS_TAIL_LIMIT),
    );
  });

  it("装载失败 → 降级为空（不阻断生成）", async () => {
    invokeMock.mockImplementation(() => Promise.reject(new Error("ipc down")));
    const { result } = renderHook(() => useSceneContext({ novelId: 1, chapterId: 5 }));
    await waitFor(() => expect(calls("list_setting_cards")).toBeGreaterThan(0));
    await waitFor(() => expect(calls("get_chapter")).toBeGreaterThan(0));
    expect(result.current.settingCards).toEqual([]);
    expect(result.current.previousChapterTail).toBe("");
  });
});

describe("useSceneContext（分级注入；暗线不进角色/旁白 Agent，stage-11 T5）", () => {
  const tieredRow = (id: number, title: string, content: string, tier: string) => ({
    id,
    novel_id: 1,
    title,
    content,
    kind: "general",
    tier,
    created_at: "c",
  });

  const tieredCards = [
    tieredRow(1, "主线规则", "月相更替潮汐涨落", "main"),
    tieredRow(2, "近期设定", "本卷只在雾隐峡", "short"),
    tieredRow(3, "幕后身份", "执灯人首领是叛徒", "dark"),
    tieredRow(4, "一次性细节", "破庙角落有把断刃", "temp"),
  ];

  beforeEach(() => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_setting_cards") return Promise.resolve(tieredCards);
      return Promise.resolve(undefined);
    });
  });

  it("默认：仅装载 `main`/`short`（**暗线 `dark` 与 `temp` 恒不注入**）", async () => {
    const { result } = renderHook(() => useSceneContext({ novelId: 1, chapterId: null }));
    await waitFor(() => expect(result.current.settingCards).toHaveLength(2));
    expect(result.current.settingCards.map((card) => card.title)).toEqual(["主线规则", "近期设定"]);
    expect(result.current.settingCards.some((card) => card.content.includes("叛徒"))).toBe(false);
  });

  it("`injectSettings=false` → 不装载任何设定卡（纯净基线）", async () => {
    const { result } = renderHook(() =>
      useSceneContext({ novelId: 1, chapterId: null, injectSettings: false }),
    );
    await waitFor(() => expect(calls("list_setting_cards")).toBeGreaterThan(0));
    expect(result.current.settingCards).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildChapterGenerationOptions } from "./build-chapter-options";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const cardRow = (id: number, title: string, content: string, tier: string) => ({
  id,
  novel_id: 1,
  title,
  content,
  kind: "general",
  tier,
  created_at: "c",
});

const chapterRow = {
  id: 5,
  volume_id: 3,
  title: "第五章",
  content: "<p>当前章</p>",
  content_format: "html",
  order_index: 1,
  status: "draft",
  word_count: 4,
  created_at: "c",
  updated_at: "u",
};

const TIERED_CARDS = [
  cardRow(1, "主线规则", "月相更替潮汐涨落", "main"),
  cardRow(2, "近期设定", "本卷只在雾隐峡", "short"),
  cardRow(3, "幕后身份", "执灯人首领是叛徒", "dark"),
  cardRow(4, "一次性细节", "破庙角落有把断刃", "temp"),
];

const userOf = (options: { messages: { role: string; content: string }[] }) =>
  options.messages.find((message) => message.role === "user")!.content;

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_setting_cards") return Promise.resolve(TIERED_CARDS);
    if (cmd === "get_chapter") return Promise.resolve(chapterRow);
    if (cmd === "list_chapters") return Promise.resolve([chapterRow]);
    return Promise.resolve(undefined);
  });
});

describe("buildChapterGenerationOptions（分级注入；暗线硬隔离）", () => {
  it("默认注入：user 段**含 main/short**，**不含 dark/temp**（暗线不进正文 prompt）", async () => {
    const options = await buildChapterGenerationOptions({
      novelId: 1,
      chapterId: 5,
      userInstruction: "续写",
      model: "m",
    });

    const user = userOf(options);
    expect(user).toContain("主线规则: 月相更替潮汐涨落");
    expect(user).toContain("近期设定: 本卷只在雾隐峡");
    expect(user).not.toContain("执灯人首领是叛徒"); // dark
    expect(user).not.toContain("破庙角落有把断刃"); // temp
    expect(user).toContain("续写");
  });

  it("注入关（`injectSettings=false`）→ 与「无设定卡」基线**逐字段一致**", async () => {
    const off = await buildChapterGenerationOptions({
      novelId: 1,
      chapterId: 5,
      userInstruction: "续写",
      model: "m",
      injectSettings: false,
    });

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_setting_cards") return Promise.resolve([]);
      if (cmd === "get_chapter") return Promise.resolve(chapterRow);
      if (cmd === "list_chapters") return Promise.resolve([chapterRow]);
      return Promise.resolve(undefined);
    });
    const baseline = await buildChapterGenerationOptions({
      novelId: 1,
      chapterId: 5,
      userInstruction: "续写",
      model: "m",
    });

    expect(off).toEqual(baseline);
    expect(userOf(off)).not.toContain("主线规则"); // 关 → 完全不注入（不泄露任何分级）
  });

  it("注入关也**不会**因开关而放行 dark（安全优先：开关不可绕过暗线隔离）", async () => {
    const off = await buildChapterGenerationOptions({
      novelId: 1,
      chapterId: 5,
      userInstruction: "续写",
      model: "m",
      injectSettings: false,
    });
    expect(userOf(off)).not.toContain("执灯人首领是叛徒");
  });
});

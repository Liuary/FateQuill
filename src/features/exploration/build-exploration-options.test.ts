import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExplorationOptions } from "./build-exploration-options";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const cardRow = {
  id: 1,
  novel_id: 1,
  title: "青灯",
  content: "青灯引航，子夜前挂三盏",
  kind: "general",
  created_at: "c",
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) =>
    cmd === "list_setting_cards" ? Promise.resolve([cardRow]) : Promise.resolve(undefined),
  );
});

describe("buildExplorationOptions（约束注入 system 段）", () => {
  it("设定卡内容并入 system（messages[0]）；intent 在 user 段", async () => {
    const { options, settingCardIds } = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上结盟",
      model: "m",
      temperature: 0.7,
    });

    const system = options.messages.find((message) => message.role === "system")!.content;
    const user = options.messages.find((message) => message.role === "user")!.content;

    expect(system).toContain("用户设定约束"); // 约束进 system 段
    expect(system).toContain("青灯: 青灯引航，子夜前挂三盏");
    expect(system).toContain("走向摘要"); // 走向卡契约仍在 system
    expect(user).toBe("北上结盟"); // intent 在 user 段
    expect(options.temperature).toBe(0.7);
    expect(settingCardIds).toEqual([1]); // 返回注入 id 集（供覆盖检查）
  });

  it("无设定卡 → 不追加约束段", async () => {
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_setting_cards" ? Promise.resolve([]) : Promise.resolve(undefined),
    );
    const { options, settingCardIds } = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "x",
      model: "m",
      temperature: 0.3,
    });

    expect(options.messages[0].content).not.toContain("用户设定约束");
    expect(settingCardIds).toEqual([]);
  });

  it("关闭零副作用：不传 hexagramGuide → 输出与基线逐字段一致（无空段残留）", async () => {
    const baseline = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
    });
    const again = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
    });

    expect(again.options).toEqual(baseline.options); // messages 深相等
    expect(again.settingCardIds).toEqual(baseline.settingCardIds);
    expect(baseline.options.messages[0].content).not.toContain("易经卦象引导"); // 无空段残留
    expect(baseline.options.messages[0].content).toContain("用户设定约束");
  });

  it("开启注入：卦象引导并入 system 段；intent（user 段）与 settingCardIds 不变", async () => {
    const baseline = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
    });
    const injected = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
      hexagramGuide: { text: "本卦：乾\n- 宿命基调承自「乾」" },
    });

    const system = injected.options.messages.find((message) => message.role === "system")!.content;
    const user = injected.options.messages.find((message) => message.role === "user")!.content;

    expect(system).toContain("易经卦象引导：");
    expect(system).toContain("宿命基调承自「乾」");
    expect(system.startsWith(baseline.options.messages[0].content)).toBe(true); // 基线段在前，追加在后
    expect(user).toBe("北上"); // user 段（intent）不变
    expect(injected.settingCardIds).toEqual(baseline.settingCardIds); // 不进 converge 覆盖判据
  });

  it("空白 hexagramGuide → 视为未传（不产生空段）", async () => {
    const baseline = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
    });
    const blank = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
      hexagramGuide: { text: "   " },
    });
    expect(blank.options).toEqual(baseline.options);
  });
});

describe("buildExplorationOptions（分级注入；暗线硬隔离，stage-11 T5）", () => {
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

  const mockCards = (rows: unknown[]) => {
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_setting_cards" ? Promise.resolve(rows) : Promise.resolve(undefined),
    );
  };

  const systemOf = (options: { messages: { role: string; content: string }[] }) =>
    options.messages.find((message) => message.role === "system")!.content;

  it("默认：system 约束段**含 main/short**、**不含 dark/temp**；`settingCardIds` 仅含可注入卡", async () => {
    mockCards(tieredCards);
    const { options, settingCardIds } = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
    });

    const system = systemOf(options);
    expect(system).toContain("月相更替潮汐涨落");
    expect(system).toContain("本卷只在雾隐峡");
    expect(system).not.toContain("执灯人首领是叛徒"); // dark
    expect(system).not.toContain("破庙角落有把断刃"); // temp
    expect(settingCardIds).toEqual([1, 2]); // 覆盖判据也不含暗线
  });

  it("`injectSettings=false` → 与「无设定卡」基线**逐字段一致**（不注入任何分级）", async () => {
    mockCards(tieredCards);
    const off = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
      injectSettings: false,
    });

    mockCards([]);
    const baseline = await buildExplorationOptions({
      novelId: 1,
      chapterId: null,
      intent: "北上",
      model: "m",
      temperature: 0.7,
    });

    expect(off.options).toEqual(baseline.options);
    expect(off.settingCardIds).toEqual([]);
    expect(systemOf(off.options)).not.toContain("用户设定约束");
  });
});

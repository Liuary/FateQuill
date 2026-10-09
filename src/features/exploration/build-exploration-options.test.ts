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
});

import { describe, expect, it } from "vitest";
import {
  buildChapterPrompt,
  CHAPTER_GENERATION_PROMPT_VERSION,
  PROMPT_BUDGET,
  type ChapterPromptInput,
} from "./chapter-generation";

const rep = (ch: string, n: number) => ch.repeat(n);

function input(over: Partial<ChapterPromptInput> = {}): ChapterPromptInput {
  return {
    systemPrompt: "系统提示",
    settingCards: [{ id: 1, title: "卡1", content: "内容1" }],
    previousChapterTail: "前文末尾",
    userInstruction: "写一章",
    model: "m1",
    temperature: 0.7,
    ...over,
  };
}

type Options = ReturnType<typeof buildChapterPrompt>;
const systemContent = (o: Options) => o.messages.find((m) => m.role === "system")!.content;
const userContent = (o: Options) => o.messages.find((m) => m.role === "user")!.content;

describe("buildChapterPrompt", () => {
  it("版本常量导出", () => {
    expect(CHAPTER_GENERATION_PROMPT_VERSION).toBe("1.0.0");
  });

  it("各源不超限 → 原样拼装", () => {
    const o = buildChapterPrompt(input());
    expect(systemContent(o)).toBe("系统提示");
    expect(userContent(o)).toBe("卡1: 内容1\n\n前文末尾\n\n写一章");
  });

  it("设定卡超 2000 → 截断至预算内", () => {
    const o = buildChapterPrompt(
      input({ settingCards: [{ id: 1, title: "T", content: rep("字", 5000) }] }),
    );
    const first = userContent(o).split("\n\n")[0];
    expect(first.length).toBeLessThanOrEqual(PROMPT_BUDGET.settingCards);
    expect(first.length).toBe(PROMPT_BUDGET.settingCards);
  });

  it("前文超 2000 → 取末尾 2000", () => {
    const long = rep("A", 3000) + rep("B", 500);
    const o = buildChapterPrompt(
      input({ settingCards: [], previousChapterTail: long, userInstruction: "指令" }),
    );
    expect(userContent(o).split("\n\n")[0]).toBe(long.slice(-PROMPT_BUDGET.prevTail));
  });

  it("合计超 8000 → 裁剪序「设定卡 → 前文」，系统与指令不裁", () => {
    const system = rep("S", 1000);
    const instruction = rep("I", 6000);
    const o = buildChapterPrompt(
      input({
        systemPrompt: system,
        settingCards: [{ id: 1, title: "T", content: rep("字", 2000) }],
        previousChapterTail: rep("P", 2000),
        userInstruction: instruction,
      }),
    );
    // 占位说明：系统（≤1000）与用户指令不裁
    expect(systemContent(o)).toBe(system);
    const uc = userContent(o);
    expect(uc.includes("T:")).toBe(false); // ① 设定卡被清空
    expect((uc.match(/I/g) ?? []).length).toBe(6000); // 指令保持
    // ② 前文被削到剩余空间 = 8000 - 1000 - 6000 = 1000
    expect((uc.match(/P/g) ?? []).length).toBe(1000);
  });

  it("输出为 provider 无关的 ChatOptions（仅 model/temperature/messages）", () => {
    const o = buildChapterPrompt(input());
    expect(Object.keys(o).sort()).toEqual(["messages", "model", "temperature"]);
    expect(o.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(o.model).toBe("m1");
    expect(o.temperature).toBe(0.7);
  });

  it("skill 注入：system 含 skill 文本（标题 + 规则），user 段不变", () => {
    const o = buildChapterPrompt(
      input({ skills: [{ title: "去套话", rule: "避免「不禁」等套话" }] }),
    );
    expect(systemContent(o)).toContain("规避要点：");
    expect(systemContent(o)).toContain("- 去套话：避免「不禁」等套话");
    expect(userContent(o)).toBe("卡1: 内容1\n\n前文末尾\n\n写一章"); // user 段与无 skill 时一致
  });

  it("skill 缺省/空数组：输出与旧实现完全一致（向后兼容）", () => {
    const baseline = buildChapterPrompt(input());
    expect(systemContent(buildChapterPrompt(input({ skills: [] })))).toBe(systemContent(baseline));
    expect(systemContent(baseline)).toBe("系统提示");
  });

  it("skill 段超 500 字 → 截断至 skills 预算内", () => {
    const longRule = rep("规", 1200);
    const o = buildChapterPrompt(
      input({ systemPrompt: "S", skills: [{ title: "T", rule: longRule }] }),
    );
    const system = systemContent(o);
    const skillsPart = system.slice(system.indexOf("规避要点："));
    expect(skillsPart.length).toBe(PROMPT_BUDGET.skills);
  });

  it("总预算超额：裁剪序「设定卡 → 前文 → skill」，skill 最后被削", () => {
    const o = buildChapterPrompt(
      input({
        systemPrompt: "S",
        settingCards: [{ id: 1, title: "T", content: rep("字", 2000) }],
        previousChapterTail: rep("P", 2000),
        userInstruction: rep("I", 6000),
        skills: [{ title: "去套话", rule: "避免套话" }],
      }),
    );
    // ① 设定卡被清空；② 前文按剩余空间削；③ skill 段最后削（此处仍保留）
    expect(userContent(o).includes("T:")).toBe(false);
    expect(systemContent(o)).toContain("规避要点：");
    const prevChars = (userContent(o).match(/P/g) ?? []).length;
    expect(prevChars).toBeGreaterThan(0);
    expect(prevChars).toBeLessThanOrEqual(PROMPT_BUDGET.prevTail);
    expect((userContent(o).match(/I/g) ?? []).length).toBe(6000); // 指令不裁
  });

  it("极端超额：skill 段最后被削（可截断）", () => {
    const o = buildChapterPrompt(
      input({
        systemPrompt: "S",
        settingCards: [],
        previousChapterTail: "",
        userInstruction: rep("I", 7990),
        skills: [{ title: "去套话", rule: "避免套话避免套话" }],
      }),
    );
    const system = systemContent(o);
    expect(system.startsWith("S\n\n")).toBe(true);
    expect(system.length - 3).toBeLessThan(20); // 被削到极小
    expect((userContent(o).match(/I/g) ?? []).length).toBe(7990); // 指令不裁
  });
});

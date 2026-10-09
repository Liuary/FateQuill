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
});

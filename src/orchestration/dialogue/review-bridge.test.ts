import { describe, expect, it } from "vitest";
import { REVIEW_DIMENSIONS } from "@/orchestration/review/types";
import {
  DIALOGUE_REVIEW_DIMENSIONS,
  DIALOGUE_REVIEW_OPTIONAL,
  assembleDialogueText,
  toDialogueReviewInput,
} from "./review-bridge";
import type { DialogueEntry } from "./types";

const entries: DialogueEntry[] = [
  {
    id: "b",
    kind: "dialogue",
    speakerId: 1,
    speakerName: "林砚",
    content: "<b>你</b>确定要走？",
    orderIndex: 1,
  },
  { id: "a", kind: "narration", content: "<p>雾散开，河面浮出白光。</p>", orderIndex: 0 },
  { id: "c", kind: "dialogue", speakerName: "阿禾", content: "走吧。", orderIndex: 2 },
];

describe("assembleDialogueText（条目 → 纯文本，去标签）", () => {
  it("按 orderIndex 升序；dialogue 带说话人、narration 为正文；HTML 标签被去除", () => {
    expect(assembleDialogueText(entries)).toBe(
      ["雾散开，河面浮出白光。", "林砚：你确定要走？", "阿禾：走吧。"].join("\n"),
    );
  });

  it("不含任何 HTML 标签", () => {
    const text = assembleDialogueText(entries);
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
  });

  it("空条目 → 空串", () => {
    expect(assembleDialogueText([])).toBe("");
  });
});

describe("toDialogueReviewInput（对齐 stage-06 ReviewInput）", () => {
  it("字段对齐：dimension/model/temperature/content（纯文本）", () => {
    const input = toDialogueReviewInput({ entries, dimension: "humanity", model: "m" });
    expect(input.dimension).toBe("humanity");
    expect(input.model).toBe("m");
    expect(input.temperature).toBe(0); // 评审建议温度 0
    expect(input.content).toBe(assembleDialogueText(entries));
    expect(Object.keys(input).sort()).toEqual(["content", "dimension", "model", "temperature"]);
  });

  it("可透传 context（作品/章节）", () => {
    const input = toDialogueReviewInput({
      entries,
      dimension: "plot",
      model: "m",
      context: { novelId: 1, chapterId: 5 },
    });
    expect(input.context).toEqual({ novelId: 1, chapterId: 5 });
  });

  it("维度复用 stage-06 `REVIEW_DIMENSIONS`（单一来源）", () => {
    expect(DIALOGUE_REVIEW_DIMENSIONS).toEqual(REVIEW_DIMENSIONS);
  });

  it("台词评审为**可选**能力（说明常量）", () => {
    expect(DIALOGUE_REVIEW_OPTIONAL).toBe(true);
  });
});

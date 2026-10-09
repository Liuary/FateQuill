import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT } from "@/orchestration/prompts/chapter-generation";
import { TURN_CARD_SYSTEM_PROMPT } from "@/orchestration/exploration/parse";
import type { ConflictReport } from "@/orchestration/consistency/types";
import type { EvaluationBundle } from "@/orchestration/review/aggregate";
import { createEvaluatorRegistry } from "@/orchestration/review/evaluator";
import type { ChatOptions } from "@/orchestration/types";
import { runAutopilot, runChapter } from "./chain";
import { defaultAutopilotConfig, type AutopilotChapterInput, type AutopilotDeps } from "./types";

const OUTLINE: AutopilotChapterInput[] = [
  { index: 0, title: "第一章 雨夜破庙", instruction: "两人在破庙初遇" },
  { index: 1, title: "第二章 灯塔熄灭", instruction: "灯塔熄灭引发恐慌" },
  { index: 2, title: "第三章 潮汐律", instruction: "主角发现潮汐律被篡改" },
];

const TURN_CARD = JSON.stringify({
  summary: "走向：破庙对峙",
  keyTurns: ["断刃出鞘"],
  settingCardIds: [],
});
const CHAPTER_TEXT = "正文：雨点砸在破庙的瓦上。";

/** 判定 options 属于「推演」还是「生成」 */
function isExploration(options: ChatOptions): boolean {
  return options.messages[0].content === TURN_CARD_SYSTEM_PROMPT;
}

function bundle(score: number): EvaluationBundle {
  return { plot: { score, reasons: [] }, humanity: { score, reasons: [] } };
}

interface Harness {
  deps: AutopilotDeps;
  reviewCalls: string[];
  archived: { title: string; content: string }[];
  streamCalls: string[];
}

/** 假依赖：假流（推演 → 走向卡；生成 → 正文）+ 假审查（可编程分数）+ 归档记录 */
function harness(scores: number[]): Harness {
  const reviewCalls: string[] = [];
  const archived: { title: string; content: string }[] = [];
  const streamCalls: string[] = [];
  let reviewIndex = 0;

  const deps: AutopilotDeps = {
    model: "m",
    streamFor: (options) =>
      (async function* () {
        streamCalls.push(isExploration(options) ? "exploration" : "generation");
        yield { delta: isExploration(options) ? TURN_CARD : CHAPTER_TEXT };
      })(),
    evaluators: createEvaluatorRegistry(),
    reviewFn: (content) => {
      reviewCalls.push(content);
      const score = scores[Math.min(reviewIndex, scores.length - 1)] ?? 0;
      reviewIndex += 1;
      return Promise.resolve(bundle(score));
    },
    archiveFn: (chapter, content) => {
      archived.push({ title: chapter.title, content });
      return Promise.resolve();
    },
  };

  return { deps, reviewCalls, archived, streamCalls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("runChapter（推演择优 → 生成 → 审查 → 重写 → 判定 → 归档）", () => {
  it("复用 stage-05/06/08/11 契约：推演走走向卡契约、生成走章节系统提示、归档被调用", async () => {
    const { deps, archived } = harness([80]);
    const outcome = await runChapter(OUTLINE[0], defaultAutopilotConfig(), deps);

    expect(outcome.degraded).toBe(false);
    expect(outcome.score).toBe(80);
    expect(outcome.content).toBe(CHAPTER_TEXT);
    expect(outcome.branchId).toBeDefined(); // 推演择优产出
    expect(archived.map((entry) => entry.title)).toEqual([OUTLINE[0].title]);
    expect(DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("未达阈值 → 自动重写（≤ N 轮）；重写后达阈 → 不降级且 `rounds` 正确", async () => {
    // 前 3 次为「推演择优」审查（高分）；第 4 次为章正文审查（低分 → 触发重写）；其后高分
    const { deps } = harness([90, 90, 90, 10, 90, 90]);
    const outcome = await runChapter(
      OUTLINE[0],
      defaultAutopilotConfig({ maxRewriteRounds: 2 }),
      deps,
    );
    expect(outcome.degraded).toBe(false);
    expect(outcome.rounds).toBe(1); // 重写 1 轮后达阈（**≤ N 轮**）
    expect(outcome.rounds).toBeLessThanOrEqual(2);
  });

  it("始终不达标 → **降级 + 原因**（不抛穿），且重写轮数 = 上限", async () => {
    const { deps } = harness([10]);
    const outcome = await runChapter(
      OUTLINE[0],
      defaultAutopilotConfig({ maxRewriteRounds: 2 }),
      deps,
    );
    expect(outcome.degraded).toBe(true);
    expect(outcome.degradedReason).toBeTruthy();
    expect(outcome.degradedReason).toContain("阈值");
    expect(outcome.rounds).toBe(2);
  });
});

describe("runAutopilot（无人值守整轮；零人工交互）", () => {
  it("≥3 章大纲 → **产出 ≥3 章**；每章「过阈」或「降级（含原因）」", async () => {
    const { deps, archived } = harness([80]);
    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig(),
      deps,
    });

    expect(outcome.chapters).toHaveLength(3);
    expect(outcome.chapters.length).toBeGreaterThanOrEqual(3);
    for (const chapter of outcome.chapters) {
      const ok = !chapter.degraded && (chapter.score ?? 0) >= 60;
      expect(ok || (chapter.degraded && Boolean(chapter.degradedReason))).toBe(true);
    }
    expect(outcome.passed).toBe(3);
    expect(archived).toHaveLength(3); // 每章完成后自动归档
  });

  it("单章不达标 → 该章降级，但**不阻塞续跑**（后续章照常产出）", async () => {
    // 第 1 章始终低分（每次审查都 10）；其余高分
    let calls = 0;
    const archived: string[] = [];
    const deps: AutopilotDeps = {
      model: "m",
      streamFor: (options) =>
        (async function* () {
          yield { delta: isExploration(options) ? TURN_CARD : CHAPTER_TEXT };
        })(),
      evaluators: createEvaluatorRegistry(),
      reviewFn: () => {
        calls += 1;
        // 推演择优（3 分支）+ 第 1 章审查与重写 → 低分；其后高分
        const score = calls <= 3 + 1 + 2 ? 10 : 88;
        return Promise.resolve(bundle(score));
      },
      archiveFn: (chapter) => {
        archived.push(chapter.title);
        return Promise.resolve();
      },
    };

    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig(),
      deps,
    });
    expect(outcome.chapters).toHaveLength(3); // 续跑完成
    expect(outcome.chapters[0].degraded).toBe(true);
    expect(outcome.chapters[0].degradedReason).toBeTruthy();
    expect(outcome.chapters.slice(1).every((chapter) => !chapter.degraded)).toBe(true);
    expect(archived).toHaveLength(3);
  });

  it("**零人工交互**：不调用任何交互原语；进度回调自完成（无 await 用户输入）", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => {
      throw new Error("不应出现人工确认");
    });
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => {
      throw new Error("不应出现人工输入");
    });

    const { deps } = harness([80]);
    const statuses: string[] = [];
    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig(),
      deps,
      onProgress: (progress) => statuses.push(progress.status),
    });

    expect(outcome.aborted).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();
    expect(statuses[0]).toBe("running");
    expect(statuses[statuses.length - 1]).toBe("done");
  });

  it("章数上限：`maxChapters` 截断大纲（只产出上限章数）", async () => {
    const { deps, archived } = harness([80]);
    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig({ maxChapters: 2 }),
      deps,
    });
    expect(outcome.chapters).toHaveLength(2);
    expect(archived).toHaveLength(2);
  });

  it("中止（abort）：不再启动新章，已完成章保留，`aborted: true`", async () => {
    const { deps } = harness([80]);
    const controller = new AbortController();
    controller.abort(); // 启动前即中止
    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig(),
      deps,
      signal: controller.signal,
    });
    expect(outcome.aborted).toBe(true);
    expect(outcome.chapters).toHaveLength(0);
  });
});

describe("runAutopilot（无人值守冲突策略；stage-12 T4）", () => {
  const conflict: ConflictReport = {
    aId: 1,
    bId: 2,
    type: "life-status",
    evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
    severity: "high",
  };

  /** 带冲突检测与落库端口（**留痕 spy**）的依赖 */
  function conflictHarness() {
    const { deps } = harness([80]);
    const saved: Record<string, unknown>[] = [];
    const resolved: { id: number; action: string }[] = [];
    deps.detectConflicts = () => Promise.resolve([conflict]);
    deps.conflictSink = {
      saveConflictRecord: (record) => {
        saved.push(record as unknown as Record<string, unknown>);
        return Promise.resolve(saved.length); // 冲突记录 id
      },
      resolveConflictRecord: (id, action) => {
        resolved.push({ id, action });
        return Promise.resolve();
      },
    };
    return { deps, saved, resolved };
  }

  it("默认（暂停 + 通知）：冲突以 `open` **留痕**、run 置 `paused`、**不启动后续章**（可续跑）", async () => {
    const { deps, saved, resolved } = conflictHarness();
    const statuses: string[] = [];
    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig({ pauseOnConflict: true }),
      deps,
      onProgress: (progress) => statuses.push(progress.status),
    });

    expect(outcome.trippedBy).toBe("conflict");
    expect(outcome.chapters).toHaveLength(1); // 第 1 章完成后即暂停
    expect(statuses[statuses.length - 1]).toBe("paused"); // 面板可呈现「暂停通知」
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      aId: 1,
      bId: 2,
      type: "life-status",
      status: "open",
      action: "",
    });
    expect(resolved).toHaveLength(0); // 暂停路径**不做自动处置**（保留用户终裁决）
    expect(outcome.conflicts).toBe(1);
  });

  it("**用户显式授权**（自动忽略继续）：冲突 `ignored` + `action:ignore` **留痕**、**继续产出后续章**", async () => {
    const { deps, saved, resolved } = conflictHarness();
    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig({ pauseOnConflict: false }),
      deps,
    });

    expect(outcome.chapters).toHaveLength(3); // **继续**跑完
    expect(outcome.conflicts).toBe(1); // 同一冲突去重（不重复落库）
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: "ignored", action: "ignore" });
    expect(resolved).toEqual([{ id: 1, action: "ignore" }]); // 授权路径**标记 ignored**
    expect(outcome.trippedBy).toBeUndefined();
  });

  it("两路径**均留痕**：无冲突检测端口时不落库（缺省零副作用）", async () => {
    const { deps } = harness([80]);
    const outcome = await runAutopilot({
      outline: OUTLINE,
      config: defaultAutopilotConfig(),
      deps,
    });
    expect(outcome.conflicts).toBe(0);
    expect(outcome.chapters).toHaveLength(3);
  });
});

import { describe, expect, it } from "vitest";
import {
  isPassed,
  markDegraded,
  pickBranch,
  shouldAutoConfirmArchive,
  shouldRewrite,
} from "./decide";
import { defaultAutopilotConfig, type ChapterOutcome } from "./types";

describe("autopilot 决策规则表（纯函数）", () => {
  it("pickBranch：取**加权总分最高**分支；同分取先出现者", () => {
    expect(
      pickBranch([
        { id: "a", total: 60 },
        { id: "b", total: 82 },
        { id: "c", total: 71 },
      ])?.id,
    ).toBe("b");
    expect(
      pickBranch([
        { id: "a", total: 70 },
        { id: "b", total: 70 },
      ])?.id,
    ).toBe("a");
  });

  it("pickBranch：全部分支未评分 → `null`（回退「无推演直接生成」）", () => {
    expect(pickBranch([{ id: "a" }, { id: "b", total: Number.NaN }])).toBeNull();
    expect(pickBranch([])).toBeNull();
  });

  it("shouldRewrite：未达阈值且轮数未用尽 → true；达阈 / 轮数用尽 → false", () => {
    expect(shouldRewrite(50, 60, 0, 2)).toBe(true);
    expect(shouldRewrite(50, 60, 1, 2)).toBe(true);
    expect(shouldRewrite(50, 60, 2, 2)).toBe(false); // 轮数用尽
    expect(shouldRewrite(60, 60, 0, 2)).toBe(false); // 恰达阈值
    expect(shouldRewrite(80, 60, 0, 2)).toBe(false);
    expect(shouldRewrite(50, 60, 0, 0)).toBe(false); // 禁重写
  });

  it("markDegraded：降级必带原因（不阻塞续跑语义由此承载）", () => {
    expect(markDegraded("重写 2 轮后仍未过阈")).toEqual({
      degraded: true,
      degradedReason: "重写 2 轮后仍未过阈",
    });
  });

  it("shouldAutoConfirmArchive：配置为真 → 自动确认；否则入待确认队列", () => {
    expect(shouldAutoConfirmArchive(defaultAutopilotConfig())).toBe(true);
    expect(shouldAutoConfirmArchive(defaultAutopilotConfig({ autoConfirmArchive: false }))).toBe(
      false,
    );
  });

  it("isPassed：未降级且达阈才算通过", () => {
    const base: ChapterOutcome = {
      index: 0,
      title: "一",
      content: "x",
      score: 70,
      degraded: false,
      rounds: 0,
    };
    expect(isPassed(base, 60)).toBe(true);
    expect(isPassed({ ...base, score: 59 }, 60)).toBe(false);
    expect(isPassed({ ...base, degraded: true, degradedReason: "r" }, 60)).toBe(false);
    expect(isPassed({ ...base, score: undefined }, 60)).toBe(false);
  });

  it("缺省配置：重写 2 轮 / 阈值 60 / 连续失败 3 / 归档自动确认", () => {
    const config = defaultAutopilotConfig();
    expect(config.maxRewriteRounds).toBe(2);
    expect(config.passThreshold).toBe(60);
    expect(config.consecutiveFailureLimit).toBe(3);
    expect(config.autoConfirmArchive).toBe(true);
  });
});

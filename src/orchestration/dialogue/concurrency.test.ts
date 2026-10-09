import { describe, expect, it } from "vitest";
import { DEFAULT_DIALOGUE_CONCURRENCY, runWithConcurrency } from "./concurrency";

describe("runWithConcurrency（并发上限 + 排队 + 乱序归位 + 失败不抛穿）", () => {
  it("并发超限排队：4 项 / limit=2 → 峰值同时运行 ≤ 2", async () => {
    let active = 0;
    let peak = 0;
    const started: number[] = [];

    const outcomes = await runWithConcurrency([0, 1, 2, 3], 2, async (item) => {
      started.push(item);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return `r${item}`;
    });

    expect(peak).toBeLessThanOrEqual(2); // 排队生效
    expect(started.slice(0, 2)).toEqual([0, 1]); // 前两项先启动
    expect(outcomes.map((outcome) => outcome.value)).toEqual(["r0", "r1", "r2", "r3"]); // 按输入序归位
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
  });

  it("乱序完成仍按输入序归位", async () => {
    const delays = [15, 0, 5]; // 第 2 项最快完成
    const outcomes = await runWithConcurrency([0, 1, 2], 3, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, delays[item]));
      return `r${item}`;
    });

    expect(outcomes.map((outcome) => outcome.index)).toEqual([0, 1, 2]);
    expect(outcomes.map((outcome) => outcome.value)).toEqual(["r0", "r1", "r2"]);
  });

  it("单项失败不抛穿：该置 ok=false，其余正常", async () => {
    const outcomes = await runWithConcurrency([0, 1, 2], 3, async (item) => {
      if (item === 1) {
        throw new Error("boom");
      }
      return `r${item}`;
    });

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, true]);
    expect(outcomes[1].error).toBe("boom");
    expect(outcomes[0].value).toBe("r0");
    expect(outcomes[2].value).toBe("r2");
  });

  it("空数组 / limit 非法 → 安全（默认并发 3；非法 limit 回退）", async () => {
    expect(await runWithConcurrency([], 3, async () => "x")).toEqual([]);
    expect(DEFAULT_DIALOGUE_CONCURRENCY).toBe(3);

    const outcomes = await runWithConcurrency([0, 1], 0, async (item) => item);
    expect(outcomes.map((outcome) => outcome.value)).toEqual([0, 1]); // 非法 limit → 回退默认（仍保序）
  });
});

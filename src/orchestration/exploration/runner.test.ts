import { describe, expect, it } from "vitest";
import type { Chunk } from "@/orchestration/types";
import { runExploration, type RunBranchInput } from "./runner";

const branches = (): RunBranchInput[] => [
  { id: "b0", temperature: 0.3, effectiveTemperature: 0.3, clamped: false },
  { id: "b1", temperature: 0.7, effectiveTemperature: 0.7, clamped: false },
  { id: "b2", temperature: 1.1, effectiveTemperature: 1, clamped: true }, // anthropic clamp
];

const card = (summary: string) =>
  JSON.stringify({ summary, keyTurns: ["转折"], settingCardIds: [1] });

describe("runExploration（并行 + 乱序归位）", () => {
  it("N 分支并行；乱序完成仍按输入顺序归位；各携带指定温度", async () => {
    const events: string[] = [];
    const results = await runExploration({
      branches: branches(),
      streamFor: (branch) => {
        events.push(`start:${branch.id}`);
        // b1 最快、b2 居中、b0 最慢 → 完成顺序（b1,b2,b0）与输入顺序（b0,b1,b2）不同
        const delay = branch.id === "b1" ? 0 : branch.id === "b2" ? 5 : 15;
        return (async function* (): AsyncIterable<Chunk> {
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          yield { delta: card(`走向-${branch.id}`) };
          events.push(`end:${branch.id}`);
        })();
      },
    });

    // 并行：三个分支均先启动，最快的 b1 结束时全部 start 均已发生
    expect(events.filter((event) => event.startsWith("start:"))).toHaveLength(3);
    expect(events.indexOf("end:b1")).toBeGreaterThan(2);

    // 归位：结果顺序 = 输入顺序（与完成顺序无关）
    expect(results.map((result) => result.id)).toEqual(["b0", "b1", "b2"]);
    expect(results.map((result) => result.card?.summary)).toEqual([
      "走向-b0",
      "走向-b1",
      "走向-b2",
    ]);
    // 各携带指定温度 + clamp 标注透传
    expect(results.map((result) => result.temperature)).toEqual([0.3, 0.7, 1.1]);
    expect(results[2].effectiveTemperature).toBe(1);
    expect(results[2].clamped).toBe(true);
    expect(results[0].clamped).toBe(false);
    expect(results.every((result) => result.status === "done")).toBe(true);
  });

  it("单分支失败 → 该分支 error，其余 done（部分结果，不抛穿）", async () => {
    const results = await runExploration({
      branches: branches(),
      streamFor: (branch) =>
        (async function* (): AsyncIterable<Chunk> {
          yield { delta: branch.id === "b1" ? "不是 JSON" : card("ok") };
        })(),
    });

    expect(results.map((result) => result.status)).toEqual(["done", "error", "done"]);
    expect(results[1].error).toBeTruthy();
    expect(results[1].card).toBeUndefined();
    expect(results[0].card?.summary).toBe("ok");
  });

  it("concurrency 上限：并发不超过 N", async () => {
    let active = 0;
    let peak = 0;
    const results = await runExploration({
      branches: branches(),
      concurrency: 2,
      streamFor: () =>
        (async function* (): AsyncIterable<Chunk> {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 1));
          yield { delta: card("ok") };
          active -= 1;
        })(),
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === "done")).toBe(true);
  });
});

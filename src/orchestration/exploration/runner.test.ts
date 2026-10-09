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

  it("并发上限 + 排队：4 分支 / concurrency=2 → 峰值活跃 ≤ 2，结果按输入归位", async () => {
    const four: RunBranchInput[] = [
      { id: "n0", temperature: 0.3, effectiveTemperature: 0.3, clamped: false },
      { id: "n1", temperature: 0.5, effectiveTemperature: 0.5, clamped: false },
      { id: "n2", temperature: 0.7, effectiveTemperature: 0.7, clamped: false },
      { id: "n3", temperature: 1.1, effectiveTemperature: 1, clamped: true },
    ];
    let active = 0;
    let peak = 0;
    const started: string[] = [];

    const results = await runExploration({
      branches: four,
      concurrency: 2,
      streamFor: (branch) =>
        (async function* (): AsyncIterable<Chunk> {
          started.push(branch.id);
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 1));
          yield { delta: card(`走向-${branch.id}`) };
          active -= 1;
        })(),
    });

    expect(peak).toBeLessThanOrEqual(2); // 超限排队
    expect(started.slice(0, 2)).toEqual(["n0", "n1"]); // 前两个先启动，其余排队
    expect(results.map((result) => result.id)).toEqual(["n0", "n1", "n2", "n3"]); // 乱序归位
    expect(results.every((result) => result.status === "done")).toBe(true);
  });

  it("abort 全停：运行中 abort → 在跑分支置 error，排队分支不启动（无悬挂）", async () => {
    const three: RunBranchInput[] = [
      { id: "a0", temperature: 0.3, effectiveTemperature: 0.3, clamped: false },
      { id: "a1", temperature: 0.7, effectiveTemperature: 0.7, clamped: false },
      { id: "a2", temperature: 1.1, effectiveTemperature: 1, clamped: true },
    ];
    const controller = new AbortController();
    const started: string[] = [];

    const results = await runExploration({
      branches: three,
      concurrency: 1,
      signal: controller.signal,
      streamFor: (branch) =>
        (async function* (): AsyncIterable<Chunk> {
          started.push(branch.id);
          if (branch.id === "a0") {
            // 模拟用户在首个分支运行期间中止
            setTimeout(() => controller.abort(), 5);
          }
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 30);
            controller.signal.addEventListener("abort", () => {
              clearTimeout(timer);
              resolve();
            });
          });
          yield { delta: card("ok") };
        })(),
    });

    expect(started).toEqual(["a0"]); // 排队分支未启动
    expect(results[0].status).toBe("error"); // 在跑分支中止
    expect(results.slice(1).every((result) => result.status === "pending")).toBe(true);
    expect(results.every((result) => result.status !== "done")).toBe(true); // 无完成结果
  });
});

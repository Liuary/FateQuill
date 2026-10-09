import { describe, expect, it } from "vitest";
import type { Chunk } from "@/orchestration/types";
import { throttleChunks } from "./throttle";

/** 源：按序产出若干 Chunk */
function source(deltas: string[]): AsyncIterable<Chunk> {
  return (async function* () {
    for (const d of deltas) yield { delta: d };
  })();
}

/** 可注入时钟：每次调用依序返回给定值，耗尽后固定为最后一个 */
function clockSequence(times: number[]): () => number {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)];
}

async function collect(src: AsyncIterable<Chunk>): Promise<string[]> {
  const out: string[] = [];
  for await (const c of src) out.push(c.delta);
  return out;
}

describe("throttleChunks", () => {
  it("窗口内全部合并，源结束冲刷为 1 块", async () => {
    // now 全为 0（init 也 0）→ 循环内永不满足窗口 → 结束时冲刷
    const out = await collect(
      throttleChunks(source(["a", "b", "c"]), { intervalMs: 50, now: clockSequence([0, 0, 0, 0]) }),
    );
    expect(out).toEqual(["abc"]);
  });

  it("跨越窗口时分组：合并已到达的块，剩余在结束冲刷", async () => {
    // init=0; chunk1→10(<50); chunk2→60(≥50 发出 "ab"；lastEmit=60); chunk3→60(<50); 结束冲刷 "c"
    const out = await collect(
      throttleChunks(source(["a", "b", "c"]), {
        intervalMs: 50,
        now: clockSequence([0, 10, 60, 60]),
      }),
    );
    expect(out).toEqual(["ab", "c"]);
  });

  it("连续跨越多个窗口逐块发出", async () => {
    // 每次发出会再取一次 now 设 lastEmit：init=0; c1 check60 发 "a"/set60; c2 check120 发 "b"/set120; c3 check180 发 "c"/set180
    const out = await collect(
      throttleChunks(source(["a", "b", "c"]), {
        intervalMs: 50,
        now: clockSequence([0, 60, 60, 120, 120, 180, 180]),
      }),
    );
    expect(out).toEqual(["a", "b", "c"]);
  });

  it("默认窗口为 50ms", async () => {
    // 不传 intervalMs → 默认 50；now=0 恒定 → 合并为 1 块
    const out = await collect(throttleChunks(source(["x", "y"]), { now: () => 0 }));
    expect(out).toEqual(["xy"]);
  });
});

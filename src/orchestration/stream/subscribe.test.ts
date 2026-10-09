import { describe, expect, it } from "vitest";
import type { Chunk } from "@/orchestration/types";
import { subscribeChunks } from "./subscribe";

function source(deltas: string[]): AsyncIterable<Chunk> {
  return (async function* () {
    for (const d of deltas) yield { delta: d };
  })();
}

async function collect(src: AsyncIterable<Chunk>): Promise<string> {
  let text = "";
  for await (const c of src) text += c.delta;
  return text;
}

describe("subscribeChunks", () => {
  it("默认 50ms：拼接总量守恒", async () => {
    // 恒定时钟 → 全部合并为 1 块，但总量等于源
    const text = await collect(subscribeChunks(source(["你", "好", "，世界"]), { now: () => 0 }));
    expect(text).toBe("你好，世界");
  });

  it("跨越窗口时分块但总量守恒", async () => {
    let i = 0;
    const times = [0, 60, 120];
    const now = () => times[Math.min(i++, times.length - 1)];
    const text = await collect(subscribeChunks(source(["a", "b", "c"]), { throttleMs: 50, now }));
    expect(text).toBe("abc");
  });
});

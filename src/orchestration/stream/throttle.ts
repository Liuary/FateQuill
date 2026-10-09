import type { Chunk } from "@/orchestration/types";

export interface ThrottleOptions {
  /** 合并窗口（默认 50ms；C-02 要求 ≥50ms） */
  intervalMs?: number;
  /** 可注入时钟（测试用；默认 Date.now） */
  now?: () => number;
}

/**
 * 节流合并：累积窗口内到达的增量，当「距上次发出 ≥ intervalMs」时合并为一个 Chunk 发出；
 * 源结束后冲刷剩余缓冲。
 */
export async function* throttleChunks(
  src: AsyncIterable<Chunk>,
  opts: ThrottleOptions = {},
): AsyncIterable<Chunk> {
  const interval = opts.intervalMs ?? 50;
  const now = opts.now ?? (() => Date.now());
  let buffer = "";
  let lastEmit = now();
  for await (const c of src) {
    buffer += c.delta;
    if (now() - lastEmit >= interval) {
      yield { delta: buffer };
      buffer = "";
      lastEmit = now();
    }
  }
  if (buffer.length > 0) yield { delta: buffer };
}

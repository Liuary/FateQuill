import type { Chunk } from "@/orchestration/types";
import { throttleChunks, type ThrottleOptions } from "./throttle";

export interface SubscribeOptions {
  throttleMs?: number;
  now?: () => number;
}

/** 订阅流：对 Chunk 异步序列施加节流，产出可消费的增量流（纯 TS，不建 store） */
export function subscribeChunks(
  src: AsyncIterable<Chunk>,
  opts: SubscribeOptions = {},
): AsyncIterable<Chunk> {
  const tOpts: ThrottleOptions = { intervalMs: opts.throttleMs ?? 50 };
  if (opts.now) tOpts.now = opts.now;
  return throttleChunks(src, tOpts);
}

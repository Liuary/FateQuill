/**
 * 并发工作池（stage-10 T6）
 *
 * 复用 stage-08 `exploration/runner.ts` 范式：**并发上限 + 超限排队**；结果**按输入序归位**
 * （与完成顺序无关）；**单项失败置 error、不抛穿**。
 */

/** 并发上限默认值 */
export const DEFAULT_DIALOGUE_CONCURRENCY = 3;

/** 单项结果（按输入序归位） */
export interface ConcurrencyOutcome<T, R> {
  item: T;
  index: number;
  ok: boolean;
  value?: R;
  error?: string;
}

/** 工作池：并发上限内并行拉取任务；结果按输入序归位；单项失败不抛穿 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<ConcurrencyOutcome<T, R>[]> {
  const effective = Math.max(1, Math.trunc(limit) || DEFAULT_DIALOGUE_CONCURRENCY);
  const results: ConcurrencyOutcome<T, R>[] = items.map((item, index) => ({
    item,
    index,
    ok: false,
  }));

  let cursor = 0;
  const workerCount = Math.min(effective, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      try {
        results[index] = {
          item: items[index],
          index,
          ok: true,
          value: await fn(items[index], index),
        };
      } catch (error) {
        // 单项失败：不抛穿（其余任务继续）
        results[index] = {
          item: items[index],
          index,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  });
  await Promise.all(workers);

  return results;
}

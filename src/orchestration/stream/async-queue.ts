/** 极简异步队列：push/close/fail，支持 for await 消费 */
export function createAsyncQueue<T>() {
  const buffer: T[] = [];
  const waiters: Array<(r: IteratorResult<T>) => void> = [];
  let done = false;
  let error: unknown = null;
  const settle = (r: IteratorResult<T>) => {
    const w = waiters.shift();
    if (w) w(r);
  };
  return {
    push(v: T) {
      if (done) return;
      if (waiters.length) settle({ value: v, done: false });
      else buffer.push(v);
    },
    close() {
      done = true;
      while (waiters.length) settle({ value: undefined as never, done: true });
    },
    fail(e: unknown) {
      error = e;
      done = true;
      while (waiters.length) settle({ value: undefined as never, done: true });
    },
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next(): Promise<IteratorResult<T>> {
          if (buffer.length) return Promise.resolve({ value: buffer.shift() as T, done: false });
          if (error) return Promise.reject(error);
          if (done) return Promise.resolve({ value: undefined as never, done: true });
          return new Promise((resolve) => waiters.push(resolve));
        },
      };
    },
  };
}

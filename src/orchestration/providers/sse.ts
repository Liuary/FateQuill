export interface SseEvent {
  event?: string;
  data: string;
}

/** 解析一个完整 SSE 事件块（块内不含结尾空行）；注释行忽略；多行 data 以 \n 连接 */
export function parseSseBlock(block: string): SseEvent | null {
  let event: string | undefined;
  const data: string[] = [];
  for (const raw of block.split(/\r?\n/)) {
    if (raw === "" || raw.startsWith(":")) continue;
    if (raw.startsWith("event:")) event = raw.slice(6).trim();
    else if (raw.startsWith("data:")) data.push(raw.slice(5).replace(/^ /, ""));
  }
  if (event === undefined && data.length === 0) return null;
  return { event, data: data.join("\n") };
}

/** 把一串完整 SSE 事件块解析为 SseEvent[]（供夹具回放与增量解析复用） */
export function parseSseStream(text: string): SseEvent[] {
  return text
    .split(/\r?\n\r?\n/)
    .map(parseSseBlock)
    .filter((e): e is SseEvent => e !== null);
}

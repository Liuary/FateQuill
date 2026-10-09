import { Channel, invoke } from "@tauri-apps/api/core";
import { parseIpcError } from "./errors";

export type StreamEvent =
  | { type: "Chunk"; data: string }
  | { type: "Done" }
  | { type: "Error"; code: string; message: string; statusCode?: number };

export interface StreamAuth {
  keyRefProvider: string;
  keyRefLabel: string;
  header: string;
  prefix: string;
}

export interface HttpStreamParams {
  /** 省略则内部生成（`crypto.randomUUID()`）；用于 Rust StreamRegistry 注册/取消（REV-011） */
  requestId?: string;
  url: string;
  headers?: Array<[string, string]>;
  body: string;
  auth?: StreamAuth;
  onEvent: (event: StreamEvent) => void;
}

/** 发起 Rust 侧 SSE 中继，返回 abort 函数 */
export async function httpStream(p: HttpStreamParams): Promise<() => Promise<void>> {
  const requestId = p.requestId ?? crypto.randomUUID(); // 缺省生成，调用方最简（REV-011）
  const channel = new Channel<StreamEvent>();
  channel.onmessage = p.onEvent;
  try {
    await invoke("http_stream", {
      requestId,
      url: p.url,
      headers: p.headers ?? [],
      body: p.body,
      auth: p.auth,
      onEvent: channel,
    });
  } catch (e) {
    throw parseIpcError(e);
  }
  return async () => {
    try {
      await invoke("abort_stream", { requestId });
    } catch (e) {
      throw parseIpcError(e);
    }
  };
}

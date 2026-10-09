import type { Chunk, ChatOptions, ModelProvider } from "@/orchestration/types";
import { httpStream, type HttpStreamParams } from "@/ipc/stream";
import { createAsyncQueue } from "@/orchestration/stream/async-queue";
import { parseSseBlock } from "./sse";

/**
 * 传输抽象：契约 = `httpStream` 的参数类型；默认直接用 `httpStream`，测试注入夹具回放。
 * 禁止「双重 as」强转——`httpStream` 必须可直接赋值给 `StreamTransport`（TS 编译期保证契约对齐）。
 */
export type StreamTransport = (p: HttpStreamParams) => Promise<() => Promise<void>>;

export interface OpenAiCompatibleOptions {
  id?: string;
  baseUrl: string; // 如 https://api.deepseek.com
  apiKeyLabel: string; // keyring label（provider 固定为 "openai-compatible"）
  transport?: StreamTransport;
}

export function createOpenAiCompatibleProvider(opts: OpenAiCompatibleOptions): ModelProvider {
  const id = opts.id ?? "openai-compatible";
  const transport: StreamTransport = opts.transport ?? httpStream; // 无强转：契约真实对齐（REV-011）
  return {
    id,
    async *stream(options: ChatOptions): AsyncIterable<Chunk> {
      const body = JSON.stringify({
        model: options.model,
        stream: true,
        messages: options.messages,
        temperature: options.temperature,
      });
      for await (const block of streamBlocks(transport, {
        url: `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`,
        headers: [
          ["content-type", "application/json"],
          ["accept", "text/event-stream"],
          ...(options.headers ? Object.entries(options.headers) : []),
        ],
        body,
        auth: {
          keyRefProvider: "openai-compatible",
          keyRefLabel: opts.apiKeyLabel,
          header: "authorization",
          prefix: "Bearer ",
        },
        signal: options.signal,
      })) {
        const ev = parseSseBlock(block);
        if (!ev) continue;
        if (ev.data === "[DONE]") return;
        const delta = extractOpenAiDelta(ev.data); // 错误帧抛错；正常帧返回文本增量
        if (delta) yield { delta };
      }
    },
  };
}

interface OpenAiFrame {
  error?: { message?: string };
  choices?: Array<{ delta?: { content?: string } }>;
}

/** 解析 openai-compatible 数据帧：返回文本增量；错误帧抛出 */
export function extractOpenAiDelta(data: string): string {
  let json: OpenAiFrame;
  try {
    json = JSON.parse(data) as OpenAiFrame;
  } catch {
    return "";
  }
  if (json.error) throw new Error(`provider error: ${json.error.message ?? "unknown"}`);
  return json.choices?.[0]?.delta?.content ?? "";
}

/** 将 transport 的回调事件流转换为「完整事件块」字符串异步序列（含 Done/Error 处理） */
export async function* streamBlocks(
  transport: StreamTransport,
  p: {
    url: string;
    headers?: Array<[string, string]>;
    body: string;
    auth?: HttpStreamParams["auth"];
    signal?: AbortSignal;
  },
): AsyncIterable<string> {
  const queue = createAsyncQueue<string>();
  const abort = await transport({
    url: p.url,
    headers: p.headers,
    body: p.body,
    auth: p.auth,
    onEvent: (e) => {
      if (e.type === "Chunk") {
        for (const b of splitBlocks(e.data)) queue.push(b);
      } else if (e.type === "Done") queue.close();
      else queue.fail(new Error(`${e.code}: ${e.message}`));
    },
  });
  p.signal?.addEventListener("abort", () => {
    void abort();
    queue.close();
  });
  try {
    for await (const block of queue) yield block;
  } finally {
    await abort().catch(() => {});
  }
}

/** 将可能包含多个事件块的字符串切分为独立块 */
function splitBlocks(data: string): string[] {
  return data
    .split(/\r?\n\r?\n/)
    .map((b) => b.trimEnd())
    .filter((b) => b.length > 0);
}

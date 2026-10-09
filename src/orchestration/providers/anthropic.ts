import type { Chunk, ChatOptions, ModelProvider } from "@/orchestration/types";
import { httpStream } from "@/ipc/stream";
import { parseSseBlock } from "./sse";
import { streamBlocks, type StreamTransport } from "./openai-compatible";

export interface AnthropicOptions {
  id?: string;
  baseUrl: string; // 如 https://api.anthropic.com
  apiKeyLabel: string; // keyring label（provider 固定为 "anthropic"）
  transport?: StreamTransport;
  maxTokens?: number;
}

export function createAnthropicProvider(opts: AnthropicOptions): ModelProvider {
  const id = opts.id ?? "anthropic";
  const transport: StreamTransport = opts.transport ?? httpStream; // 无强转：契约真实对齐（REV-011）
  return {
    id,
    async *stream(options: ChatOptions): AsyncIterable<Chunk> {
      const body = JSON.stringify({
        model: options.model,
        stream: true,
        max_tokens: opts.maxTokens ?? 4096,
        messages: options.messages,
        temperature: options.temperature,
      });
      for await (const block of streamBlocks(transport, {
        url: `${opts.baseUrl.replace(/\/$/, "")}/v1/messages`,
        headers: [
          ["content-type", "application/json"],
          ["accept", "text/event-stream"],
          ["anthropic-version", "2023-06-01"],
          ...(options.headers ? Object.entries(options.headers) : []),
        ],
        body,
        auth: {
          keyRefProvider: "anthropic",
          keyRefLabel: opts.apiKeyLabel,
          header: "x-api-key",
          prefix: "",
        },
        signal: options.signal,
      })) {
        const ev = parseSseBlock(block);
        if (!ev) continue;
        if (ev.event === "message_stop") return;
        const delta = extractAnthropicDelta(ev.data); // 错误帧抛错；content_block_delta 返回文本
        if (delta) yield { delta };
      }
    },
  };
}

interface AnthropicFrame {
  type?: string;
  error?: { message?: string };
  delta?: { text?: string };
}

/** 解析 anthropic 数据帧：content_block_delta → 文本；含 error 抛出 */
export function extractAnthropicDelta(data: string): string {
  let json: AnthropicFrame;
  try {
    json = JSON.parse(data) as AnthropicFrame;
  } catch {
    return "";
  }
  if (json.error) throw new Error(`provider error: ${json.error.message ?? "unknown"}`);
  if (json.type === "content_block_delta") return json.delta?.text ?? "";
  return "";
}

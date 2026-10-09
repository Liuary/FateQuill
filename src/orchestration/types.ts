/** provider 无关的流式增量块（前端协议适配器输出单元） */
export interface Chunk {
  delta: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** provider 流式调用选项（headers 仅非 Key 头；授权头由 Rust 侧注入） */
export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** 可插拔模型 Provider（自研 SSE 协议适配器实现，≥2 个） */
export interface ModelProvider {
  readonly id: string;
  stream(options: ChatOptions): AsyncIterable<Chunk>;
}

export interface ModelRef {
  providerId: string;
  model: string;
}

/** Agent 角色定义（注册表可注册/替换） */
export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  modelRef: ModelRef;
  temperature?: number;
  tools?: string[];
}

/** Pipeline 步骤：结构化上下文输入/输出 */
export interface PipelineStep<In = unknown, Out = unknown> {
  readonly id: string;
  run(input: In): Promise<Out>;
}

/** 可组合管线 */
export interface Pipeline {
  readonly id: string;
  readonly steps: PipelineStep[];
}

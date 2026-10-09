import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelProvider } from "@/orchestration/types";
import { createOpenAiCompatibleProvider } from "@/orchestration/providers/openai-compatible";
import { createAnthropicProvider } from "@/orchestration/providers/anthropic";

/** 由模型配置实例化 provider 适配器（baseUrl/label 来自配置；Key 由 Rust 侧按 label 注入） */
export function resolveProviderForConfig(cfg: ModelConfig): ModelProvider {
  return cfg.provider === "anthropic"
    ? createAnthropicProvider({ baseUrl: cfg.baseUrl, apiKeyLabel: cfg.label })
    : createOpenAiCompatibleProvider({
        id: cfg.provider,
        baseUrl: cfg.baseUrl,
        apiKeyLabel: cfg.label,
      });
}

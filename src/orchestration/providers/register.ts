import type { ProviderRegistry } from "@/orchestration/registry";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import { createAnthropicProvider } from "./anthropic";

/** 注册内置 provider（新增 Provider：新建适配器文件 + 在此加一行） */
export function registerBuiltinProviders(
  registry: ProviderRegistry,
  cfg?: {
    openAiBaseUrl?: string;
    openAiLabel?: string;
    anthropicBaseUrl?: string;
    anthropicLabel?: string;
  },
) {
  registry.register(
    createOpenAiCompatibleProvider({
      baseUrl: cfg?.openAiBaseUrl ?? "",
      apiKeyLabel: cfg?.openAiLabel ?? "default",
    }),
  );
  registry.register(
    createAnthropicProvider({
      baseUrl: cfg?.anthropicBaseUrl ?? "",
      apiKeyLabel: cfg?.anthropicLabel ?? "default",
    }),
  );
}

/**
 * 模型 provider **预设清单**（stage-03 op-008）
 *
 * 用途：设置页「模型配置」表单的下拉预设——选择后**自动填充** `baseUrl` / `modelName`（字段仍可编辑）。
 *
 * 口径：
 * - `adapter` 表示**协议适配器**：`openai-compatible`（OpenAI 兼容：国内主流厂商与自建网关均属此类）/ `anthropic`；
 *   与 `resolve-provider` 的分派一致（`cfg.provider === "anthropic"` → Anthropic 适配器，其余走 OpenAI 兼容适配器）。
 * - `id` 即写入 `model_config.provider` 的值（**字符串列，无需迁移**）；`label`（用户自定义）与 keyring 条目一一对应。
 * - `name` 为**中文可读名**（专有名词，不参与 i18n，避免触发键完整性约束）。
 * - `defaultModel` 仅作填充建议（各厂商模型名会演进，用户可改）。
 */

/** provider 协议适配器类型 */
export type ProviderAdapter = "openai-compatible" | "anthropic";

/** provider 预设 */
export interface ProviderPreset {
  /** 写入 `model_config.provider` 的 id（亦为适配器 `id`） */
  id: string;
  /** 表单展示名（中文可读名，专有名词不译） */
  name: string;
  /** 协议适配器 */
  adapter: ProviderAdapter;
  /** 默认接口地址（`custom` 为空，由用户填写） */
  baseUrl: string;
  /** 建议模型名（可选；仅用于填充） */
  defaultModel?: string;
}

/** 预设清单（顺序即下拉顺序） */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    adapter: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    adapter: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-sonnet-latest",
  },
  {
    id: "deepseek",
    name: "DeepSeek 深度求索",
    adapter: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    adapter: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
  },
  {
    id: "qwen",
    name: "通义千问（DashScope）",
    adapter: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
  },
  {
    id: "moonshot",
    name: "月之暗面 Kimi",
    adapter: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    adapter: "openai-compatible",
    baseUrl: "https://api.siliconflow.cn/v1",
  },
  {
    id: "minimax",
    name: "MiniMax",
    adapter: "openai-compatible",
    baseUrl: "https://api.minimax.chat/v1",
  },
  {
    id: "custom",
    name: "自定义（OpenAI 兼容）",
    adapter: "openai-compatible",
    baseUrl: "",
  },
];

/** 自定义预设 id（选择后显示 provider id 文本输入） */
export const CUSTOM_PRESET_ID = "custom";

/** 按 id 反查预设（未命中 → `undefined`，调用方视为自定义） */
export function findPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === id);
}

/** 是否为已登记预设 id */
export function isPresetId(id: string): boolean {
  return findPreset(id) !== undefined;
}

/** provider → 表单选中的预设 id（未命中 → `custom`；用于**编辑既有配置回显**） */
export function presetIdForProvider(provider: string): string {
  return isPresetId(provider) ? provider : CUSTOM_PRESET_ID;
}

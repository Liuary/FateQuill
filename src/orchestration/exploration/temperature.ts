/**
 * 推演温度集与 per-provider clamp（stage-08 T1）
 *
 * 职责：默认温度集、provider 温度区间与 clamp（越界分支可标注）、localStorage 持久化。
 */

/** 默认温度集（低/中/高三档） */
export const DEFAULT_TEMPERATURES = [0.3, 0.7, 1.1] as const;

/** per-provider 温度区间 `[min, max]`；未知 provider 回退 `[0, 2]` */
export const PROVIDER_TEMPERATURE_RANGE: Record<string, [number, number]> = {
  "openai-compatible": [0, 2],
  anthropic: [0, 1],
};

/** 温度集持久化键 */
export const TEMPERATURE_STORAGE_KEY = "fatequill.exploration.temperatures";

/** 回退区间（未知 provider） */
const FALLBACK_RANGE: [number, number] = [0, 2];

/**
 * 按 provider 区间 clamp 温度：返回**有效温度**与**是否被 clamp**（越界分支 UI 标注）。
 */
export function clampTemperature(
  temperature: number,
  providerId: string,
): { effective: number; clamped: boolean } {
  const [min, max] = PROVIDER_TEMPERATURE_RANGE[providerId] ?? FALLBACK_RANGE;
  const effective = Math.min(max, Math.max(min, temperature));
  return { effective, clamped: effective !== temperature };
}

/** 读取持久化温度集；缺失/损坏/非有限数 → 默认集 */
export function loadTemperatures(): number[] {
  if (typeof localStorage === "undefined") {
    return [...DEFAULT_TEMPERATURES];
  }
  try {
    const raw = localStorage.getItem(TEMPERATURE_STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_TEMPERATURES];
    }
    const parsed: unknown = JSON.parse(raw);
    const temperatures = Array.isArray(parsed)
      ? parsed.filter(
          (value): value is number => typeof value === "number" && Number.isFinite(value),
        )
      : [];
    return temperatures.length > 0 ? temperatures : [...DEFAULT_TEMPERATURES];
  } catch {
    // 存储不可用 / JSON 损坏：回退默认集
    return [...DEFAULT_TEMPERATURES];
  }
}

/** 写入持久化温度集（存储不可用时静默忽略，仅会话内生效） */
export function saveTemperatures(temperatures: number[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(TEMPERATURE_STORAGE_KEY, JSON.stringify(temperatures));
  } catch {
    // 隐私模式 / 配额：忽略
  }
}

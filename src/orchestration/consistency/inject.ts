/**
 * 设定分级注入（stage-11 T5）
 *
 * 职责：**装载侧过滤**——只有白名单分级进入生成 / 推演 / 对话 prompt：
 * `tier ∈ { main, short }`；**`dark`（暗线）恒排除**（暗线泄露 = 剧透事故，硬隔离、无开关可绕过）；
 * `temp`（一次性细节）亦不注入。**纯函数、无 IO、不改预算结构**（裁剪沿用既有装载侧序）。
 */

/** 可注入分级白名单（**不含 `dark` / `temp`**） */
export const INJECTABLE_TIERS = ["main", "short"] as const;

/** 可注入分级值 */
export type InjectableTier = (typeof INJECTABLE_TIERS)[number];

/**
 * 分级是否可注入 prompt：
 * - `main` / `short` → `true`；
 * - `dark`（暗线）/ `temp`（一次性）→ `false`；
 * - **未标注**（`null` / 空串，如历史数据）→ `true`：沿用 DB/前端默认 `tier='short'` 的既有注入行为；
 * - **未知值** → `false`（**fail-closed**：白名单外一律不注入）。
 */
export function isInjectableTier(tier: unknown): boolean {
  if (tier == null || tier === "") {
    return true;
  }
  return (INJECTABLE_TIERS as readonly unknown[]).includes(tier);
}

/**
 * 白名单过滤设定卡：生产路径**恒排除 `dark`**（安全硬要求）。
 * 泛型保持入参形态（`SettingCard` / 行对象 / 测试夹具均可）。
 */
export function selectInjectableCards<T extends { tier?: unknown }>(cards: T[]): T[] {
  return cards.filter((card) => isInjectableTier(card.tier));
}

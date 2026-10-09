/** 设定卡：世界观 / 设定条目 */

/** 设定卡类型**受控枚举**（`kind` 字段仍为 `string`，保持**向后兼容**：历史自定义值不被拒绝） */
export const SETTING_CARD_KINDS = ["general", "fate", "character", "settingCard"] as const;

/** 受控枚举值 */
export type SettingCardKind = (typeof SETTING_CARD_KINDS)[number];

/**
 * 设定卡**分级**受控枚举（四级；与 `kind` **正交**——`kind`=内容类型，`tier`=叙事层级）：
 * `main` 贯穿全书核心约定 / `dark` 隐藏设定（未揭示，**不注入正文**）/ `short` 近期章节有效 / `temp` 一次性细节。
 */
export const SETTING_CARD_TIERS = ["main", "dark", "short", "temp"] as const;

/** 分级值 */
export type SettingCardTier = (typeof SETTING_CARD_TIERS)[number];

/** 缺省分级（短线保守默认，与迁移 v5 的 `DEFAULT 'short'` 一致） */
export const DEFAULT_SETTING_CARD_TIER: SettingCardTier = "short";

/** 分级校验（值域判定；未知值 → `false`） */
export function isSettingCardTier(value: unknown): value is SettingCardTier {
  return typeof value === "string" && (SETTING_CARD_TIERS as readonly string[]).includes(value);
}

export interface SettingCard {
  id: number;
  novelId: number;
  title: string;
  content: string;
  kind: string;
  /** 叙事层级（四级；与 `kind` 正交） */
  tier: SettingCardTier;
  createdAt: string;
}

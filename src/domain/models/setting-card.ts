/** 设定卡：世界观 / 设定条目 */

/** 设定卡类型**受控枚举**（`kind` 字段仍为 `string`，保持**向后兼容**：历史自定义值不被拒绝） */
export const SETTING_CARD_KINDS = ["general", "fate", "character", "settingCard"] as const;

/** 受控枚举值 */
export type SettingCardKind = (typeof SETTING_CARD_KINDS)[number];

export interface SettingCard {
  id: number;
  novelId: number;
  title: string;
  content: string;
  kind: string;
  createdAt: string;
}

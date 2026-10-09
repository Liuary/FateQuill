/**
 * 研究受控标签（stage-07 T3）
 *
 * 职责：标注的**受控标签枚举**（AI 味类型）与版本常量。标签为受控枚举（非法值拒绝），
 * 自由补充说明由「备注」承载（入库并入 `material.reason`）。
 */

/** 受控标签版本（枚举变更时递增） */
export const RESEARCH_TAGS_VERSION = "0.1.0";

/** 受控标签枚举：套话 / 排比 / 空洞形容 / 翻译腔 */
export const RESEARCH_TAGS = ["cliche", "parallelism", "empty", "translationese"] as const;

/** 受控标签类型 */
export type ResearchTag = (typeof RESEARCH_TAGS)[number];

/** 受控枚举校验（非法标签拒绝） */
export function isValidTag(value: string): value is ResearchTag {
  return (RESEARCH_TAGS as readonly string[]).includes(value);
}

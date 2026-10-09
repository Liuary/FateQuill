/**
 * 干支基础（stage-12 T1）
 *
 * 十天干 / 十二地支 / **六十甲子**（阳配阳、阴配阴）/ **十干寄宫**（大六壬通行表述）。
 * **纯静态数据 + 纯函数**；**不引历法库**（方案 b：手动月将 + 时辰 + 手动日干支）。
 */

/** 十天干 */
export const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

/** 十二地支（子 = 0） */
export const EARTHLY_BRANCHES = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

/** 六十甲子（60 项；下标 0 = 甲子） */
export const JIAZI_60: string[] = Array.from({ length: 60 }, (_, index) => {
  const stem = HEAVENLY_STEMS[index % 10];
  const branch = EARTHLY_BRANCHES[index % 12];
  return `${stem}${branch}`;
});

/** 是否为合法六十甲子（含干支单字合法性） */
export function isJiazi(value: string): boolean {
  return JIAZI_60.includes(value);
}

/**
 * 十干寄宫（大六壬通行）：甲寄寅、乙寄辰、丙戊寄巳、丁己寄未、庚寄申、辛寄戌、壬寄亥、癸寄丑。
 * 用于「第一课」下神的取法（本实现取**寄宫支**，见 `docs/liuren-data.md` 口径）。
 */
export const STEM_HOME_PALACE: Record<string, string> = {
  甲: "寅",
  乙: "辰",
  丙: "巳",
  丁: "未",
  戊: "巳",
  己: "未",
  庚: "申",
  辛: "戌",
  壬: "亥",
  癸: "丑",
};

/** 地支 → 地盘下标（非地支 → -1） */
export function branchIndex(branch: string): number {
  return (EARTHLY_BRANCHES as readonly string[]).indexOf(branch);
}

/** 日干支 → 天干（非法 → 空串） */
export function stemOf(ganzhi: string): string {
  return isJiazi(ganzhi) ? ganzhi.slice(0, 1) : "";
}

/** 日干支 → 地支（非法 → 空串） */
export function branchOf(ganzhi: string): string {
  return isJiazi(ganzhi) ? ganzhi.slice(1) : "";
}

/** 相冲（地支六冲）：子午 / 丑未 / 寅申 / 卯酉 / 辰戌 / 巳亥 */
export function isOpposite(a: string, b: string): boolean {
  const i = branchIndex(a);
  const j = branchIndex(b);
  return i >= 0 && j >= 0 && (i + 6) % 12 === j;
}

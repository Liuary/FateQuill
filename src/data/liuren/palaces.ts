/**
 * 十二宫与月将（stage-12 T1）
 *
 * 地盘十二宫（固定 子…亥）+ 各支对应的**月将（月将名）**：
 * 子—神后、丑—大吉、寅—功曹、卯—太冲、辰—天罡、巳—太乙、午—胜光、未—小吉、申—传送、酉—从魁、戌—河魁、亥—登明。
 * **月将为「月将加时」的输入**（方案 b：**由用户手动指定**，不做农历/节气换算）。
 */

import type { LiurenPalace } from "./types";

export const LIUREN_PALACES: LiurenPalace[] = [
  { branch: "子", generalName: "神后", element: "水", order: 0 },
  { branch: "丑", generalName: "大吉", element: "土", order: 1 },
  { branch: "寅", generalName: "功曹", element: "木", order: 2 },
  { branch: "卯", generalName: "太冲", element: "木", order: 3 },
  { branch: "辰", generalName: "天罡", element: "土", order: 4 },
  { branch: "巳", generalName: "太乙", element: "火", order: 5 },
  { branch: "午", generalName: "胜光", element: "火", order: 6 },
  { branch: "未", generalName: "小吉", element: "土", order: 7 },
  { branch: "申", generalName: "传送", element: "金", order: 8 },
  { branch: "酉", generalName: "从魁", element: "金", order: 9 },
  { branch: "戌", generalName: "河魁", element: "土", order: 10 },
  { branch: "亥", generalName: "登明", element: "水", order: 11 },
];

/** 地支 → 五行（取自 `LIUREN_PALACES`；非法 → 空串） */
export function elementOfBranch(branch: string): string {
  return LIUREN_PALACES.find((palace) => palace.branch === branch)?.element ?? "";
}

/** 地支 → 月将名（非法 → 空串） */
export function generalNameOfBranch(branch: string): string {
  return LIUREN_PALACES.find((palace) => palace.branch === branch)?.generalName ?? "";
}

/** 月将名 → 地支（非法 → 空串） */
export function branchOfGeneralName(name: string): string {
  return LIUREN_PALACES.find((palace) => palace.generalName === name)?.branch ?? "";
}

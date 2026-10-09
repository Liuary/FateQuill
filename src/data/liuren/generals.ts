/**
 * 十二天将（stage-12 T1）
 *
 * 顺布顺序（贵人为首）：贵人 → 螣蛇 → 朱雀 → 六合 → 勾陈 → 青龙 → 天空 → 白虎 → 太常 → 玄武 → 太阴 → 天后。
 * **六吉六凶**：贵人 / 六合 / 青龙 / 太常 / 太阴 / 天后为吉；螣蛇 / 朱雀 / 勾陈 / 天空 / 白虎 / 玄武为凶。
 */

import type { LiurenGeneral } from "./types";

export const LIUREN_GENERALS: LiurenGeneral[] = [
  { name: "贵人", order: 1, nature: "吉", brief: "主尊长、助力、决议" },
  { name: "螣蛇", order: 2, nature: "凶", brief: "主惊扰、虚诈、缠绕" },
  { name: "朱雀", order: 3, nature: "凶", brief: "主文书、口舌、是非" },
  { name: "六合", order: 4, nature: "吉", brief: "主和合、私通、成约" },
  { name: "勾陈", order: 5, nature: "凶", brief: "主牵绊、争执、迟滞" },
  { name: "青龙", order: 6, nature: "吉", brief: "主财喜、升迁、正事" },
  { name: "天空", order: 7, nature: "凶", brief: "主虚耗、失信、不实" },
  { name: "白虎", order: 8, nature: "凶", brief: "主伤损、疾厄、急迫" },
  { name: "太常", order: 9, nature: "吉", brief: "主衣食、宴乐、常事" },
  { name: "玄武", order: 10, nature: "凶", brief: "主暗昧、盗失、隐匿" },
  { name: "太阴", order: 11, nature: "吉", brief: "主阴私、内助、庇护" },
  { name: "天后", order: 12, nature: "吉", brief: "主恩泽、婚育、庇佑" },
];

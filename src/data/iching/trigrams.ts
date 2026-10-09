/**
 * 八卦（stage-09 T1）
 *
 * `binary` 为 3 位字符串，**自下而上**（第 1 位=初爻）：1=阳爻，0=阴爻。
 * 先天/后天概念不参与本约定（仅用二进制与上下卦组合）。
 */

import type { Trigram } from "./types";

/** 八卦（binary 自下而上） */
export const TRIGRAMS: Trigram[] = [
  { name: "乾", symbol: "☰", binary: "111" },
  { name: "兑", symbol: "☱", binary: "110" },
  { name: "离", symbol: "☲", binary: "101" },
  { name: "震", symbol: "☳", binary: "100" },
  { name: "巽", symbol: "☴", binary: "011" },
  { name: "坎", symbol: "☵", binary: "010" },
  { name: "艮", symbol: "☶", binary: "001" },
  { name: "坤", symbol: "☷", binary: "000" },
];

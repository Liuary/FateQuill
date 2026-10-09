/**
 * 起卦与解读契约（stage-09 T2）
 *
 * 依 REV-007：`Casting` 为**跨组件状态**，落在 `explorationStore`（见 store）。
 */

import type { Hexagram } from "@/data/iching/types";

/**
 * 朱熹《易学启蒙》解读指引：指向**本卦/之卦**的卦辞或指定爻辞。
 * - `source`：读本卦 / 之卦 / 两者（三爻变）；
 * - `lineIndices`：应读的爻位（自下而上 0~5；三爻变/六爻变时为卦辞故为空）；
 * - `primaryIndex`：有主爻时的主爻位（二爻变 → 上爻；四爻变 → 下爻）。
 */
export interface ZhuXiReading {
  changingCount: number;
  source: "ben" | "zhi" | "both";
  lineIndices: number[];
  primaryIndex?: number;
}

/** 一次起卦的完整结果 */
export interface Casting {
  /** 本卦（由 6 爻取象） */
  benGua: Hexagram;
  /** 之卦（变爻取反） */
  zhiGua: Hexagram;
  /** 变爻下标（自下而上 0~5） */
  changingLines: number[];
  /** 朱熹解读指引 */
  reading: ZhuXiReading;
}

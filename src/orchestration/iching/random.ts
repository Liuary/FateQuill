/**
 * 起卦法（stage-09 T2）
 *
 * - `castRandom(rng?)`：**三枚铜钱法**（6→老阴(变) / 7→少阳 / 8→少阴 / 9→老阳(变)，自下而上 6 爻）；
 *   随机源**可注入**（测试确定性 / 种子复现）。
 * - `createSeededRng(seed)`：mulberry32 确定性随机源。
 * - `castManual(binary, changingLineIndices?)`：**手动起卦**（直接指定本卦与变爻）。
 *
 * **不提供时间起卦**（农历/干支）：v0.3 不呈现（不引入历法依赖，C-08）。
 */

import type { LineState } from "@/data/iching/types";

/** 三枚铜钱之和 → 爻（6 老阴(变) / 7 少阳 / 8 少阴 / 9 老阳(变)） */
function coinSumToLine(sum: number): LineState {
  switch (sum) {
    case 6:
      return { yang: false, changes: true }; // 老阴（变）
    case 7:
      return { yang: true, changes: false }; // 少阳
    case 8:
      return { yang: false, changes: false }; // 少阴
    default:
      return { yang: true, changes: true }; // 9 老阳（变）
  }
}

/** 掷一枚铜钱：2 或 3（各半） */
function tossCoin(rng: () => number): number {
  return rng() < 0.5 ? 2 : 3;
}

/** 随机起卦（三枚铜钱法，自下而上 6 爻） */
export function castRandom(rng: () => number = Math.random): LineState[] {
  const lines: LineState[] = [];
  for (let index = 0; index < 6; index += 1) {
    lines.push(coinSumToLine(tossCoin(rng) + tossCoin(rng) + tossCoin(rng)));
  }
  return lines;
}

/** mulberry32：32 位种子的确定性伪随机源（同一 seed → 同一序列，可复现） */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 手动起卦：指定本卦 `binary`（6 位自下而上）+ 可选变爻下标（默认无变爻） */
export function castManual(binary: string, changingLineIndices: number[] = []): LineState[] {
  if (!/^[01]{6}$/.test(binary)) {
    throw new Error(`invalid binary: ${binary}`);
  }
  const changing = new Set(changingLineIndices);
  return [...binary].map((bit, index) => ({ yang: bit === "1", changes: changing.has(index) }));
}

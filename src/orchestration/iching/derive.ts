/**
 * 起卦推导与朱熹变爻规则（stage-09 T2，**纯函数**）
 *
 * - `deriveHexagram(lines)`：6 爻（自下而上）→ 本卦 / 之卦（变爻取反）/ 变爻下标 / 朱熹解读；
 * - `zhuXiReading(...)`：朱熹《易学启蒙》**七情形**（0~6 爻变）解读指引；
 * - `readingVerses(casting)`：据指引取应读**经文原文**（卦辞/爻辞；**不译**）。
 */

import { HEXAGRAMS } from "@/data/iching/hexagrams";
import type { Hexagram, LineState } from "@/data/iching/types";
import type { Casting, ZhuXiReading } from "./types";

/** 6 爻（自下而上）→ binary（1=阳 0=阴，第 1 位=初爻） */
export function linesToBinary(lines: LineState[]): string {
  return lines.map((line) => (line.yang ? "1" : "0")).join("");
}

/** 按 binary 查卦（数据校验保证 64 卦 binary 全覆盖且唯一） */
function findByBinary(binary: string): Hexagram {
  const hexagram = HEXAGRAMS.find((item) => item.binary === binary);
  if (!hexagram) {
    throw new Error(`unknown hexagram binary: ${binary}`);
  }
  return hexagram;
}

/** 由 6 爻（自下而上）推导本卦/之卦/变爻；**之卦 = 变爻取反** */
export function deriveHexagram(lines: LineState[]): Casting {
  if (lines.length !== 6) {
    throw new Error(`cast must have exactly 6 lines, got ${lines.length}`);
  }
  const benGua = findByBinary(linesToBinary(lines));
  const zhiBinary = lines
    .map((line) => ((line.changes ? !line.yang : line.yang) ? "1" : "0"))
    .join("");
  const zhiGua = findByBinary(zhiBinary);
  const changingLines = lines
    .map((line, index) => (line.changes ? index : -1))
    .filter((index) => index >= 0);
  return { benGua, zhiGua, changingLines, reading: zhuXiReading(changingLines, benGua, zhiGua) };
}

/**
 * 朱熹《易学启蒙》七情形解读指引：
 * | 爻变数 | 依据 |
 * | ------ | ---- |
 * | 0 | 本卦卦辞 |
 * | 1 | 本卦变爻爻辞 |
 * | 2 | 本卦两变爻爻辞（**以上爻为主**） |
 * | 3 | 本卦与之卦卦辞 |
 * | 4 | 之卦两不变爻爻辞（**以下爻为主**） |
 * | 5 | 之卦不变爻爻辞 |
 * | 6 | 之卦卦辞 |
 */
export function zhuXiReading(
  changingLines: number[],
  benGua: Hexagram,
  zhiGua: Hexagram,
): ZhuXiReading {
  const sorted = [...new Set(changingLines)].sort((a, b) => a - b);

  // 一致性校验（防御）：变爻集合必须等于两卦 binary 的差异位
  const delta = [...benGua.binary]
    .map((bit, index) => (bit !== zhiGua.binary[index] ? index : -1))
    .filter((index) => index >= 0);
  if (delta.join(",") !== sorted.join(",")) {
    throw new Error("changing lines do not match the delta between ben/zhi hexagrams");
  }

  const unchanged = [0, 1, 2, 3, 4, 5].filter((index) => !sorted.includes(index));
  switch (sorted.length) {
    case 0:
      return { changingCount: 0, source: "ben", lineIndices: [] };
    case 1:
      return { changingCount: 1, source: "ben", lineIndices: sorted };
    case 2:
      // 二爻变：两变爻爻辞，以上爻为主
      return {
        changingCount: 2,
        source: "ben",
        lineIndices: sorted,
        primaryIndex: sorted[sorted.length - 1],
      };
    case 3:
      // 三爻变：本卦与之卦卦辞
      return { changingCount: 3, source: "both", lineIndices: [] };
    case 4:
      // 四爻变：之卦两不变爻，以下爻为主
      return {
        changingCount: 4,
        source: "zhi",
        lineIndices: unchanged,
        primaryIndex: unchanged[0],
      };
    case 5:
      // 五爻变：之卦不变爻爻辞
      return { changingCount: 5, source: "zhi", lineIndices: unchanged };
    default:
      // 六爻变：之卦卦辞
      return { changingCount: 6, source: "zhi", lineIndices: [] };
  }
}

/** 据朱熹指引取应读**经文原文**（卦辞 / 爻辞；**原样，不翻译**） */
export function readingVerses(casting: Casting): string[] {
  const { reading, benGua, zhiGua } = casting;
  const benLines = reading.source !== "zhi" ? reading.lineIndices : [];
  const zhiLines = reading.source !== "ben" ? reading.lineIndices : [];
  const verses: string[] = [];

  if (reading.source === "both") {
    verses.push(benGua.judgment, zhiGua.judgment);
    return verses;
  }
  if (reading.lineIndices.length === 0) {
    // 0 / 6 爻变：整卦卦辞
    verses.push(reading.source === "zhi" ? zhiGua.judgment : benGua.judgment);
    return verses;
  }
  for (const index of benLines) {
    verses.push(benGua.lines[index]);
  }
  for (const index of zhiLines) {
    verses.push(zhiGua.lines[index]);
  }
  return verses;
}

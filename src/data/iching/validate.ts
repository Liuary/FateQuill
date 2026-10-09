/**
 * 六十四卦**手写校验**（stage-09 T1）
 *
 * 依 REV-006 裁决：**不引入任何第三方校验库**（C-08 / 零新增依赖）——六条校验规则本就需自定义逻辑，
 * 以手写类型守卫 + 运行时断言实现。
 *
 * 六条规则：① 卦数 = 64；② 每卦 6 爻（合计 384）；③ 卦名唯一；④ 上下卦组合覆盖 8×8；
 * ⑤ King Wen 卦序连续 1~64；⑥ 二进制 ↔ 卦名映射自洽。
 */

import type { Hexagram, Trigram } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** 二进制 ↔ 上下卦名（**自下而上**：前 3 位 = 下卦，后 3 位 = 上卦） */
export function binaryToNames(
  binary: string,
  trigrams: Trigram[],
): { upper: string; lower: string } {
  const lowerBits = binary.slice(0, 3);
  const upperBits = binary.slice(3, 6);
  return {
    lower: trigrams.find((trigram) => trigram.binary === lowerBits)?.name ?? "",
    upper: trigrams.find((trigram) => trigram.binary === upperBits)?.name ?? "",
  };
}

/** 六条规则校验（逐条收集 errors；`ok` 为全部通过） */
export function validateIChing(hexagrams: Hexagram[], trigrams: Trigram[]): ValidationResult {
  const errors: string[] = [];

  // ① 卦数 = 64
  if (hexagrams.length !== 64) {
    errors.push(`卦数应为 64，实际 ${hexagrams.length}`);
  }

  // ② 每卦 6 爻（合计 384）
  const totalLines = hexagrams.reduce((sum, hexagram) => sum + hexagram.lines.length, 0);
  if (totalLines !== 384) {
    errors.push(`爻辞总数应为 384，实际 ${totalLines}`);
  }
  for (const hexagram of hexagrams) {
    if (hexagram.lines.length !== 6) {
      errors.push(
        `卦 ${hexagram.kingWen} ${hexagram.name} 爻数应为 6，实际 ${hexagram.lines.length}`,
      );
    }
  }

  // ③ 卦名唯一
  const names = hexagrams.map((hexagram) => hexagram.name);
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  if (duplicates.length > 0) {
    errors.push(`卦名重复：${duplicates.join("、")}`);
  }

  // ④ 上下卦组合覆盖 8×8
  const combos = new Set(hexagrams.map((hexagram) => `${hexagram.upper}|${hexagram.lower}`));
  if (combos.size !== 64) {
    errors.push(`上下卦组合应覆盖 64 种（8×8），实际 ${combos.size}`);
  }
  if (trigrams.length !== 8) {
    errors.push(`八卦应为 8 个，实际 ${trigrams.length}`);
  }

  // ⑤ King Wen 卦序连续 1~64
  const orders = hexagrams.map((hexagram) => hexagram.kingWen).sort((a, b) => a - b);
  const expected = Array.from({ length: 64 }, (_, index) => index + 1);
  if (orders.length !== 64 || orders.some((value, index) => value !== expected[index])) {
    errors.push("King Wen 卦序应为 1~64 连续无缺");
  }

  // ⑥ 二进制 ↔ 卦名映射自洽
  for (const hexagram of hexagrams) {
    if (!/^[01]{6}$/.test(hexagram.binary)) {
      errors.push(`卦 ${hexagram.name} 的 binary 应为 6 位 0/1，实际「${hexagram.binary}」`);
      continue;
    }
    const { upper, lower } = binaryToNames(hexagram.binary, trigrams);
    if (upper !== hexagram.upper || lower !== hexagram.lower) {
      errors.push(
        `卦 ${hexagram.name}（binary ${hexagram.binary}）映射不一致：期望上/下=${upper}/${lower}，实际=${hexagram.upper}/${hexagram.lower}`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

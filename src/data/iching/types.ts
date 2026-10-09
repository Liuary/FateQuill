/**
 * 六十四卦数据契约（stage-09 T1）
 *
 * 约定（详见 `docs/iching-data.md`）：
 * - **爻位自下而上**（0=初爻，5=上爻）；
 * - `binary` 6 位字符串，**第 1 位 = 初爻（下卦最低位）**，第 6 位 = 上爻；
 * - `upper`/`lower` 为八卦名（三爻，自下而上）。
 */

/** 爻状态（自下而上）；`yang`=阳爻，`changes`=老阳/老阴（变爻） */
export interface LineState {
  yang: boolean;
  /** 老阳 / 老阴（变爻） */
  changes: boolean;
}

/** 八卦（三爻，自下而上）；`binary` 为 3 位字符串，如乾 `"111"` */
export interface Trigram {
  name: string;
  symbol: string;
  binary: string;
}

/** 六十四卦（King Wen 序） */
export interface Hexagram {
  /** King Wen 卦序 1..64 */
  kingWen: number;
  /** 卦名（唯一） */
  name: string;
  /** 6 位（自下而上），如乾 `"111111"` */
  binary: string;
  /** 上卦名（八卦之一） */
  upper: string;
  /** 下卦名 */
  lower: string;
  /** 卦辞（白文） */
  judgment: string;
  /** 6 条爻辞（自下而上，长度 = 6） */
  lines: string[];
}

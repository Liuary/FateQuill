/**
 * 大六壬课体契约（stage-12 T1）
 *
 * **纯函数**（`cast.ts` / `guide.ts` 产出与消费）；`LIUREN_DATA_VERSION` 见 `src/data/liuren`。
 */

/** 一课（下神 → 上神） */
export interface LiurenLesson {
  /** 课序 1..4 */
  index: number;
  /** 课名（一课…四课） */
  label: string;
  /** 下神（地支；一课取日干寄宫支） */
  lower: string;
  /** 上神（地支，取自天盘） */
  upper: string;
  brief: string;
}

/** 一传（初 / 中 / 末） */
export interface LiurenTransmission {
  index: number;
  label: string;
  /** 传神（地支） */
  branch: string;
  brief: string;
}

/** 课体（发用取法结论） */
export interface LiurenPatternResult {
  /** 课体名（九宗门之一） */
  name: string;
  /** 取用规则（来自静态数据） */
  rule: string;
  /** 本次取用依据（人类可读，含**简化说明**） */
  basis: string;
}

/** 大六壬课体（一次起课的完整结果） */
export interface LiurenChart {
  /** 日干支（六十甲子之一） */
  dayGanzhi: string;
  dayGan: string;
  dayZhi: string;
  /** 月将（地支；**手动指定**） */
  monthGeneral: string;
  /** 月将名（登明 / 河魁 / …） */
  monthGeneralName: string;
  /** 时辰（地支；**手动指定**） */
  hourBranch: string;
  /** 昼夜（`卯..申` 为昼，其余为夜；用于**天乙贵人**取宫） */
  daytime: boolean;
  /** 地盘十二宫（固定 子…亥） */
  earth: string[];
  /** 天盘十二支（按地盘宫顺序；`月将加时` 顺布） */
  heaven: string[];
  /** 天将十二宫（按地盘宫顺序；贵人起宫后顺/逆布） */
  heavenGenerals: string[];
  /** 四课 */
  lessons: LiurenLesson[];
  /** 三传 */
  transmissions: LiurenTransmission[];
  /** 课体 */
  pattern: LiurenPatternResult;
}

/** 起课结果（**失败不抛穿**：非法输入 → `ok:false`） */
export type CastLiurenResult = { ok: true; chart: LiurenChart } | { ok: false; error: string };

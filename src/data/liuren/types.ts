/**
 * 大六壬数据契约（stage-12 T1）
 *
 * **只读静态数据**（公有领域古籍白文；**不引入今人断语集**）+ 手写校验。
 * 本域数据仅承载「课体引导」所需的**结构框架**与**通行基础表述**，**不含**任何现代注释或断验细则。
 */

/** 五行 */
export type Wuxing = "木" | "火" | "土" | "金" | "水";

/** 天将吉凶属性 */
export type GeneralNature = "吉" | "凶";

/** 十二天将（顺布顺序 1..12） */
export interface LiurenGeneral {
  /** 天将名（贵人 / 螣蛇 / …） */
  name: string;
  /** 顺布序号（1 起） */
  order: number;
  /** 吉凶属性（六吉六凶） */
  nature: GeneralNature;
  /** 通行基础表述（引导用，一句话） */
  brief: string;
}

/** 十二宫（地盘十二支 + 对应月将名） */
export interface LiurenPalace {
  /** 地支（子…亥） */
  branch: string;
  /** 月将名（神后 / 大吉 / 功曹 / …，即该支对应的「月将」称谓） */
  generalName: string;
  /** 地支五行 */
  element: Wuxing;
  /** 地盘序号（0 起，子=0） */
  order: number;
}

/** 四课课位定义（结构框架，非具体盘面） */
export interface LiurenLessonSlot {
  /** 课序（1..4） */
  index: number;
  /** 课名（一课 / 二课 / 三课 / 四课） */
  label: string;
  /** 取法依据（下神 → 上神） */
  basis: string;
  brief: string;
}

/** 三传位定义（初 / 中 / 末） */
export interface LiurenTransmissionSlot {
  index: number;
  label: string;
  brief: string;
}

/** 课体（九宗门：发用取法） */
export interface LiurenPattern {
  /** 课体名（贼克课 / 比用课 / …） */
  name: string;
  /** 取用规则（一句话） */
  rule: string;
  brief: string;
}

/** 大六壬静态数据集合（`validateLiuren` 的输入） */
export interface LiurenData {
  generals: LiurenGeneral[];
  palaces: LiurenPalace[];
  lessonSlots: LiurenLessonSlot[];
  transmissionSlots: LiurenTransmissionSlot[];
  patterns: LiurenPattern[];
}

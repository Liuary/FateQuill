/**
 * 四课三传与课体框架（stage-12 T1）
 *
 * **结构框架 + 通行基础表述**（公有领域白文口径）；具体盘面数值由 `src/orchestration/liuren/cast.ts` 计算。
 * 本文件**不含**今人断语集与断验细则。
 */

import type { LiurenLessonSlot, LiurenTransmissionSlot, LiurenPattern } from "./types";

/** 四课课位（下神 → 上神） */
export const LIUREN_LESSON_SLOTS: LiurenLessonSlot[] = [
  {
    index: 1,
    label: "一课",
    basis: "下神取日干（寄宫支），上神取其天盘上神",
    brief: "主本身、当下所处之位",
  },
  {
    index: 2,
    label: "二课",
    basis: "下神取一课上神，上神再取其天盘上神",
    brief: "主相邻、近事之应",
  },
  {
    index: 3,
    label: "三课",
    basis: "下神取日支，上神取其天盘上神",
    brief: "主家宅、配偶、所居之地",
  },
  {
    index: 4,
    label: "四课",
    basis: "下神取三课上神，上神再取其天盘上神",
    brief: "主外来、远事之应",
  },
];

/** 三传位（初 / 中 / 末） */
export const LIUREN_TRANSMISSION_SLOTS: LiurenTransmissionSlot[] = [
  { index: 1, label: "初传", brief: "发用：事之端与当前着力处" },
  { index: 2, label: "中传", brief: "初传之上神：事之中段推移" },
  { index: 3, label: "末传", brief: "中传之上神：事之结局与归宿" },
];

/** 课体（九宗门：发用取法）——本实现按简化顺序判定（见 `cast.ts` 与 `docs/liuren-data.md`） */
export const LIUREN_PATTERNS: LiurenPattern[] = [
  {
    name: "贼克课",
    rule: "四课中下贼上（或上克下）者唯一，即取为发用",
    brief: "一贼一克，取用最直",
  },
  { name: "比用课", rule: "贼克者不止一位，取与日干同类者为发用", brief: "多贼多克，取比日干者" },
  { name: "涉害课", rule: "贼克者多而俱不比，取涉害深者为发用", brief: "涉害深者先用" },
  { name: "遥克课", rule: "四课无贼无克，取二上神与日干遥相克者为用", brief: "遥相为克" },
  { name: "昴星课", rule: "四课无贼无克且无遥克，依阴日阳日取上神为用", brief: "无克取昴星" },
  { name: "别责课", rule: "四课不全（三课备）者，另取合神为用", brief: "课体不全，别取合神" },
  { name: "八专课", rule: "干支同位（日干寄宫与日支同宫）者，取其神为用", brief: "干支同位" },
  { name: "伏吟课", rule: "月将与时辰同支（天地盘不动）者，取干上神为用", brief: "天地不动" },
  { name: "返吟课", rule: "月将与时辰相冲（天地盘全逆）者，取相冲之神为用", brief: "天地全逆" },
];

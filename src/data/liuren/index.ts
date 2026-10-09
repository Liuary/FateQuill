/**
 * 大六壬静态数据统一出口（stage-12 T1）
 *
 * 只读静态数据（公有领域古籍白文口径）+ 手写校验。**无副作用、无 IO、无第三方依赖**。
 */

import { LIUREN_GENERALS } from "./generals";
import { LIUREN_LESSON_SLOTS, LIUREN_PATTERNS, LIUREN_TRANSMISSION_SLOTS } from "./lessons";
import { LIUREN_PALACES } from "./palaces";
import type { LiurenData } from "./types";

/** 大六壬数据版本（数据/框架变更时递增） */
export const LIUREN_DATA_VERSION = "1.0.0";

/** 数据集合（供 `validateLiuren` 与编排层使用） */
export const LIUREN_DATA: LiurenData = {
  generals: LIUREN_GENERALS,
  palaces: LIUREN_PALACES,
  lessonSlots: LIUREN_LESSON_SLOTS,
  transmissionSlots: LIUREN_TRANSMISSION_SLOTS,
  patterns: LIUREN_PATTERNS,
};

export * from "./types";
export * from "./ganzhi";
export * from "./generals";
export * from "./palaces";
export * from "./lessons";
export * from "./validate";

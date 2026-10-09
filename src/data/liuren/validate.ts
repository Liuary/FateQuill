/**
 * 大六壬数据**手写校验**（stage-12 T1）
 *
 * 遵 REV-006 先例：**不引第三方校验库**；纯手写守卫 + 构建期/测试期断言。
 *
 * 校验规则：① 天将 = 12（唯一、序号 1..12 连续）；② 宫 = 12（十二支齐全且唯一、月将名唯一、五行合法、序号 0..11）；
 * ③ 四课 = 4（课序 1..4）；④ 三传 = 3（序 1..3）；⑤ 课体 = 9 且含伏吟/返吟；⑥ 六十甲子 = 60 且唯一；
 * ⑦ 十干寄宫齐全且寄宫为合法地支。
 */

import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  JIAZI_60,
  STEM_HOME_PALACE,
  branchIndex,
} from "./ganzhi";
import type { LiurenData, Wuxing } from "./types";

export interface LiurenValidationResult {
  ok: boolean;
  errors: string[];
}

const VALID_ELEMENTS: Wuxing[] = ["木", "火", "土", "金", "水"];

/** 校验大六壬静态数据（不回写；`ok` 为全部通过） */
export function validateLiuren(data: LiurenData): LiurenValidationResult {
  const errors: string[] = [];

  // ① 十二天将
  if (data.generals.length !== 12) {
    errors.push(`天将应为 12，实际 ${data.generals.length}`);
  }
  if (new Set(data.generals.map((general) => general.name)).size !== data.generals.length) {
    errors.push("天将名称重复");
  }
  const orders = data.generals.map((general) => general.order).sort((a, b) => a - b);
  if (orders.join(",") !== Array.from({ length: 12 }, (_, index) => index + 1).join(",")) {
    errors.push(`天将序号应为 1..12 连续，实际 ${orders.join(",")}`);
  }
  if (data.generals.some((general) => general.nature !== "吉" && general.nature !== "凶")) {
    errors.push("天将吉凶属性非法");
  }

  // ② 十二宫
  if (data.palaces.length !== 12) {
    errors.push(`宫应为 12，实际 ${data.palaces.length}`);
  }
  const palaceBranches = data.palaces.map((palace) => palace.branch);
  if (new Set(palaceBranches).size !== palaceBranches.length) {
    errors.push("宫位地支重复");
  }
  if (EARTHLY_BRANCHES.some((branch) => !palaceBranches.includes(branch))) {
    errors.push("宫位地支不全（应含十二支）");
  }
  const generalNames = data.palaces.map((palace) => palace.generalName);
  if (new Set(generalNames).size !== generalNames.length) {
    errors.push("月将名重复");
  }
  if (data.palaces.some((palace) => !VALID_ELEMENTS.includes(palace.element))) {
    errors.push("宫位五行非法");
  }
  const palaceOrders = data.palaces.map((palace) => palace.order).sort((a, b) => a - b);
  if (palaceOrders.join(",") !== Array.from({ length: 12 }, (_, index) => index).join(",")) {
    errors.push(`宫位序号应为 0..11 连续，实际 ${palaceOrders.join(",")}`);
  }

  // ③ 四课 / ④ 三传
  if (data.lessonSlots.length !== 4) {
    errors.push(`四课课位应为 4，实际 ${data.lessonSlots.length}`);
  }
  if (data.lessonSlots.map((slot) => slot.index).join(",") !== "1,2,3,4") {
    errors.push("四课课序应为 1..4");
  }
  if (data.transmissionSlots.length !== 3) {
    errors.push(`三传位应为 3，实际 ${data.transmissionSlots.length}`);
  }
  if (data.transmissionSlots.map((slot) => slot.index).join(",") !== "1,2,3") {
    errors.push("三传序应为 1..3");
  }

  // ⑤ 课体（九宗门）
  if (data.patterns.length !== 9) {
    errors.push(`课体应为 9（九宗门），实际 ${data.patterns.length}`);
  }
  const patternNames = data.patterns.map((pattern) => pattern.name);
  if (new Set(patternNames).size !== patternNames.length) {
    errors.push("课体名重复");
  }
  for (const required of ["伏吟课", "返吟课", "贼克课"]) {
    if (!patternNames.includes(required)) {
      errors.push(`课体缺 ${required}`);
    }
  }

  // ⑥ 六十甲子
  if (JIAZI_60.length !== 60) {
    errors.push(`六十甲子应为 60，实际 ${JIAZI_60.length}`);
  }
  if (new Set(JIAZI_60).size !== 60) {
    errors.push("六十甲子重复");
  }

  // ⑦ 十干寄宫
  for (const stem of HEAVENLY_STEMS) {
    const home = STEM_HOME_PALACE[stem];
    if (!home) {
      errors.push(`天干 ${stem} 缺寄宫`);
      continue;
    }
    if (branchIndex(home) < 0) {
      errors.push(`天干 ${stem} 寄宫非法：${home}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

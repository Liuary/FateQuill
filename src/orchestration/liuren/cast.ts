/**
 * 大六壬起课（stage-12 T1）
 *
 * **方案 b（拍板）**：**手动月将 + 时辰 + 日干支**（**不引历法库**；自动农历/节气换算留后续）。
 *
 * 盘面（本实现的**明确口径**，详见 `docs/liuren-data.md`）：
 * 1. **天盘**：`月将加时` 顺布 —— 月将安于时辰宫上，余支按地盘宫序顺行；
 * 2. **四课**：一课 = 日干寄宫支（下）→ 其天盘上神（上）；二课 = 一课上神（下）→ 其天盘上神（上）；
 *    三课 = 日支（下）→ 其天盘上神（上）；四课 = 三课上神（下）→ 其天盘上神（上）；
 * 3. **三传**：初传 = 发用（贼克法取用）；中传 = 初传之上神；末传 = 中传之上神；
 * 4. **天将**：天乙贵人起宫（按日干取昼/夜贵）后**顺布**（贵落亥至辰）或**逆布**（贵落巳至戌）。
 *
 * **简化声明（产品定位 = 课体引导，非真断卦）**：取用顺序实现为「**先判天地盘特例**（月将 = 时辰 → 伏吟课；
 * 月将与时支相冲 → 返吟课）→ 再贼克法（下贼上优先 → 唯一即取；多则取与日干比者；无贼取克，多则取比者；
 * 俱无 → 昴星课）」；「涉害深浅」「遥克」「别责」「八专」仅作**课体名标注**（本实现不细分取用），见
 * `docs/liuren-data.md`「简化口径」。
 */

import { LIUREN_GENERALS } from "@/data/liuren/generals";
import {
  LIUREN_LESSON_SLOTS,
  LIUREN_PATTERNS,
  LIUREN_TRANSMISSION_SLOTS,
} from "@/data/liuren/lessons";
import { LIUREN_PALACES, generalNameOfBranch } from "@/data/liuren/palaces";
import {
  EARTHLY_BRANCHES,
  STEM_HOME_PALACE,
  branchIndex,
  branchOf,
  isJiazi,
  isOpposite,
  stemOf,
} from "@/data/liuren/ganzhi";
import type { LiurenLesson, LiurenPatternResult, CastLiurenResult } from "./types";

/** 起课输入（**三者皆为手动指定**） */
export interface CastLiurenInput {
  /** 月将（地支，子…亥） */
  monthGeneral: string;
  /** 时辰（地支，子…亥） */
  hourBranch: string;
  /** 日干支（六十甲子之一；**必填** —— 四课须以日干支为据，见 REV-006 定稿） */
  dayGanzhi: string;
}

/** 五行相克 */
const OVERCOMES: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

/** 地支 → 五行（非法 → 空串） */
function elementOf(branch: string): string {
  return LIUREN_PALACES.find((palace) => palace.branch === branch)?.element ?? "";
}

/** 前支是否克后支 */
function overcomes(from: string, to: string): boolean {
  const fromElement = elementOf(from);
  const toElement = elementOf(to);
  return Boolean(fromElement && toElement) && OVERCOMES[fromElement] === toElement;
}

/** 天乙贵人口诀（甲戊庚牛羊 / 乙己鼠猴乡 / 丙丁猪鸡位 / 壬癸蛇兔藏 / 六辛逢马虎）：[昼贵, 夜贵] */
const NOBLE_PALACE: Record<string, [string, string]> = {
  甲: ["丑", "未"],
  戊: ["丑", "未"],
  庚: ["丑", "未"],
  乙: ["子", "申"],
  己: ["子", "申"],
  丙: ["亥", "酉"],
  丁: ["亥", "酉"],
  壬: ["巳", "卯"],
  癸: ["巳", "卯"],
  辛: ["午", "寅"],
};

/** 昼夜判定（本实现口径）：时辰落 `卯..申` 为昼，其余为夜 */
function isDaytime(hourBranch: string): boolean {
  const index = branchIndex(hourBranch);
  return index >= branchIndex("卯") && index <= branchIndex("申");
}

/** 天将布将：贵人落宫后，落亥至辰**顺布**、巳至戌**逆布**（按地盘宫序输出） */
function placeGenerals(nobleBranch: string): string[] {
  const nobleIndex = branchIndex(nobleBranch);
  const forward = branchIndex("亥") <= nobleIndex && nobleIndex <= branchIndex("辰");
  return EARTHLY_BRANCHES.map((_, palace) => {
    const offset = forward ? palace - nobleIndex : nobleIndex - palace;
    const index = ((offset % 12) + 12) % 12;
    return LIUREN_GENERALS[index].name;
  }) as string[];
}

/** 课体结论（规则取自**静态数据单一来源**，依据为本实现口径） */
function patternOf(name: string, basis: string): LiurenPatternResult {
  const slot = LIUREN_PATTERNS.find((pattern) => pattern.name === name);
  return { name, rule: slot?.rule ?? "", basis };
}

/** 取用（**先判天地盘特例**：伏吟 / 返吟 → 再贼克法，简化）：返回 [发用支, 课体] */
function takeUse(
  lessons: LiurenLesson[],
  dayGan: string,
  input: CastLiurenInput,
): [string, LiurenPatternResult] {
  // 天地盘特例优先（伏吟 / 返吟按盘面状态定课体，先于贼克判定）
  if (input.monthGeneral === input.hourBranch) {
    return [
      lessons[0].upper,
      patternOf("伏吟课", "月将 = 时辰 → 天地盘伏吟，取一课（干上）上神为发用"),
    ];
  }
  if (isOpposite(input.monthGeneral, input.hourBranch)) {
    return [
      lessons[2].upper,
      patternOf("返吟课", "月将与时辰相冲 → 天地盘返吟，取三课（支上）上神为发用"),
    ];
  }

  const zei = lessons.filter((lesson) => overcomes(lesson.lower, lesson.upper)); // 下贼上
  const ke = lessons.filter((lesson) => overcomes(lesson.upper, lesson.lower)); // 上克下

  const pick = (candidates: LiurenLesson[]): LiurenLesson => {
    if (candidates.length === 1) {
      return candidates[0];
    }
    // 多位 → 取与日干（寄宫支）同五行者（「比」）；仍无则取首位
    const same = candidates.filter(
      (lesson) => elementOf(lesson.lower) === elementOf(STEM_HOME_PALACE[dayGan]),
    );
    return same[0] ?? candidates[0];
  };

  if (zei.length > 0) {
    const lesson = pick(zei);
    return [
      lesson.upper,
      patternOf(
        zei.length === 1 ? "贼克课" : "比用课",
        zei.length === 1
          ? "四课中**下贼上**（下克上）者仅一位 → 直取该课上神为发用"
          : "下贼上者多位 → 取与日干同五行者（比）为发用（**简化**：不较涉害深浅）",
      ),
    ];
  }
  if (ke.length > 0) {
    const lesson = pick(ke);
    return [
      lesson.upper,
      patternOf(
        ke.length === 1 ? "贼克课" : "比用课",
        ke.length === 1
          ? "四课中**上克下**者仅一位 → 直取该课上神为发用"
          : "上克下者多位 → 取与日干同五行者（比）为发用（**简化**：不较涉害深浅）",
      ),
    ];
  }
  // 无贼无克（且非伏吟 / 返吟）：昴星
  return [
    lessons[0].upper,
    patternOf("昴星课", "四课无贼无克 → 取一课（干上）上神为发用（**模拟化**口径）"),
  ];
}

/** 起课（失败不抛穿：非法输入 → `{ ok:false, error }`） */
export function castLiuren(input: CastLiurenInput): CastLiurenResult {
  const { monthGeneral, hourBranch, dayGanzhi } = input;
  if (branchIndex(monthGeneral) < 0) {
    return { ok: false, error: `月将非法：${monthGeneral}` };
  }
  if (branchIndex(hourBranch) < 0) {
    return { ok: false, error: `时辰非法：${hourBranch}` };
  }
  if (!isJiazi(dayGanzhi)) {
    return { ok: false, error: `日干支非法：${dayGanzhi}` };
  }

  const dayGan = stemOf(dayGanzhi);
  const dayZhi = branchOf(dayGanzhi);
  const homePalace = STEM_HOME_PALACE[dayGan];

  // ① 天盘：月将加时（顺布）
  const shift = (((branchIndex(monthGeneral) - branchIndex(hourBranch)) % 12) + 12) % 12;
  const heaven = EARTHLY_BRANCHES.map(
    (_, palace) => EARTHLY_BRANCHES[(palace + shift) % 12],
  ) as string[];

  /** 取某支的天盘上神 */
  const upperOf = (branch: string): string => heaven[branchIndex(branch)];

  // ② 四课
  const lessonUppers = [upperOf(homePalace), "", upperOf(dayZhi), ""];
  lessonUppers[1] = upperOf(lessonUppers[0]);
  lessonUppers[3] = upperOf(lessonUppers[2]);
  const lowers = [homePalace, lessonUppers[0], dayZhi, lessonUppers[2]];
  const lessons: LiurenLesson[] = LIUREN_LESSON_SLOTS.map((slot, index) => ({
    index: slot.index,
    label: slot.label,
    lower: lowers[index],
    upper: lessonUppers[index],
    brief: slot.brief,
  }));

  // ③ 三传（初传 = 发用；中 / 末传 = 前传之上神）
  const [first, pattern] = takeUse(lessons, dayGan, input);
  const middle = upperOf(first);
  const last = upperOf(middle);
  const branches = [first, middle, last];
  const transmissions = LIUREN_TRANSMISSION_SLOTS.map((slot, index) => ({
    index: slot.index,
    label: slot.label,
    branch: branches[index],
    brief: slot.brief,
  }));

  // ④ 天将（昼 / 夜贵人 → 顺 / 逆布）
  const daytime = isDaytime(hourBranch);
  const nobleBranch = NOBLE_PALACE[dayGan][daytime ? 0 : 1];

  return {
    ok: true,
    chart: {
      dayGanzhi,
      dayGan,
      dayZhi,
      monthGeneral,
      monthGeneralName: generalNameOfBranch(monthGeneral),
      hourBranch,
      daytime,
      earth: [...EARTHLY_BRANCHES],
      heaven,
      heavenGenerals: placeGenerals(nobleBranch),
      lessons,
      transmissions,
      pattern,
    },
  };
}

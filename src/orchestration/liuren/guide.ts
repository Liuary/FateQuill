/**
 * 大六壬引导卡与文本（stage-12 T1）
 *
 * 职责：把 `LiurenChart`（**纯数据**）渲染为**课体引导**（卡结构 + 注入 prompt 的文本），
 * 口径与 stage-09 `iching/guide.ts` 一致（引导**仅作参考**，不替代用户设定约束）。
 */

import type { LiurenChart } from "./types";

/** 引导卡（结构化展示；`lines` 为逐行文本） */
export interface LiurenGuideCard {
  title: string;
  subtitle: string;
  /** 课体（含取用依据） */
  pattern: string;
  /** 四课（`一课：寅 → 午`） */
  lessons: string[];
  /** 三传（`初传：午`） */
  transmissions: string[];
  /** 天盘摘录（`地盘子上见 X`） */
  heavenSummary: string;
  /** 天将摘录 */
  generalsSummary: string;
  lines: string[];
}

/** 四课格式化（下神 → 上神） */
function formatLessons(chart: LiurenChart): string[] {
  return chart.lessons.map((lesson) => `${lesson.label}：${lesson.lower} → ${lesson.upper}`);
}

/** 三传格式化 */
function formatTransmissions(chart: LiurenChart): string[] {
  return chart.transmissions.map((transmission) => `${transmission.label}：${transmission.branch}`);
}

/** 天盘摘录（按地盘宫序，取前 12 项完整摘录） */
function formatHeaven(chart: LiurenChart): string {
  return chart.earth.map((branch, index) => `${branch}上见${chart.heaven[index]}`).join("、");
}

/** 天将摘录（按地盘宫序） */
function formatGenerals(chart: LiurenChart): string {
  return chart.earth.map((branch, index) => `${branch}乘${chart.heavenGenerals[index]}`).join("、");
}

/** 构造引导卡（结构 + 逐行文本；供 UI 与注入复用） */
export function buildLiurenCard(chart: LiurenChart): LiurenGuideCard {
  const lessons = formatLessons(chart);
  const transmissions = formatTransmissions(chart);
  const heavenSummary = formatHeaven(chart);
  const generalsSummary = formatGenerals(chart);
  const pattern = `${chart.pattern.name}（${chart.pattern.basis}）`;

  return {
    title: `大六壬课体：${chart.pattern.name}`,
    subtitle: `日干支 ${chart.dayGanzhi}｜月将 ${chart.monthGeneralName}（${chart.monthGeneral}）｜时辰 ${chart.hourBranch}｜${chart.daytime ? "昼" : "夜"}占`,
    pattern,
    lessons,
    transmissions,
    heavenSummary,
    generalsSummary,
    lines: [
      `课体：${pattern}`,
      `四课：${lessons.join("；")}`,
      `三传：${transmissions.join("；")}`,
      `天盘：${heavenSummary}`,
      `天将：${generalsSummary}`,
    ],
  };
}

/** 渲染引导文本（注入推演 / 生成 prompt 的 `system` 约束段；**仅作参考**） */
export function renderLiurenText(chart: LiurenChart): string {
  const card = buildLiurenCard(chart);
  return [
    `【大六壬课体引导】${card.subtitle}`,
    ...card.lines.map((line) => `- ${line}`),
    "- 说明：课体引导仅为叙事参考，**不得违背用户设定约束**；未揭示的暗线不得因此泄露。",
  ].join("\n");
}

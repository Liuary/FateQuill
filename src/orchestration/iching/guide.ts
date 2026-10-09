/**
 * 卦象引导卡：剧情映射（stage-09 T3）
 *
 * 定位：**「走向意向的结构化来源之一」**——把起卦结果映射为可注入 system 段的引导文本。
 * - **确定性**：同一卦象 → 同一引导卡（无随机、无时间依赖，便于单测）；
 * - **经文不译**：卦辞/爻辞一律取 `src/data/iching` 白文**原样**；
 * - **不进入 `converge` 设定卡覆盖判据**（设定卡约束仍最高优先）。
 */

import { readingVerses } from "./derive";
import type { Casting } from "./types";

/** 卦象引导卡 */
export interface GuideCard {
  /** 本卦卦名 */
  hexagramName: string;
  /** 本卦卦辞（白文；超长截取前 N 字作摘要，保留原文用字） */
  judgmentDigest: string;
  /** 依朱熹七情形应读的经文（卦辞 / 爻辞；白文原样） */
  changingLineReadings: string[];
  /** 剧情提示（确定性模板；引用卦名/上下卦象/变爻） */
  plotHints: string[];
  /** 宿命提示（确定性模板） */
  fateHints: string[];
}

/** 卦辞摘要长度上限（保留白文；超出截取并加省略号） */
const JUDGMENT_DIGEST_LIMIT = 40;

/** 卦辞摘要（超长截断，保留原文用字） */
function digestJudgment(judgment: string): string {
  return judgment.length <= JUDGMENT_DIGEST_LIMIT
    ? judgment
    : `${judgment.slice(0, JUDGMENT_DIGEST_LIMIT)}…`;
}

/** 爻变数 → 宿命基调（确定性模板） */
const FATE_BY_CHANGING_COUNT: Record<number, string> = {
  0: "六爻皆静：此局由人不由天，结局取决于既有选择。",
  1: "一爻动：牵一发而动全身，留意该处生变。",
  2: "二爻动：两处并起，以上者为先。",
  3: "三爻动：本末交错，宜守中。",
  4: "四爻动：大势已成，下者先应。",
  5: "五爻动：仅余一隙，成败悬于一线。",
  6: "六爻皆动：翻局之象，旧局尽改。",
};

/** 由起卦结果构造引导卡（**确定性**：同卦象同输出；经文原样不译） */
export function buildGuideCard(casting: Casting): GuideCard {
  const { benGua, zhiGua, changingLines, reading } = casting;

  const plotHints: string[] = [
    `本卦「${benGua.name}」（${benGua.upper}上${benGua.lower}下）：以此局定开篇基调。`,
  ];
  if (changingLines.length === 0) {
    plotHints.push("六爻皆静：局势未动，宜承接既有线索稳步推进。");
  } else {
    plotHints.push(
      `变爻 ${changingLines.map((index) => index + 1).join("、")}（自下而上）：转折落在对应节奏点上。`,
    );
    plotHints.push(`之卦「${zhiGua.name}」：走向落在此局，可作为本段收束方向。`);
  }
  if (reading.changingCount === 3) {
    plotHints.push("三爻变：本卦与之卦并读，双线并行推进。");
  }
  if (reading.primaryIndex !== undefined) {
    plotHints.push(`主爻为第 ${reading.primaryIndex + 1} 爻：以其为段落重心。`);
  }

  const fateHints: string[] = [
    `宿命基调承自「${benGua.name}」：${FATE_BY_CHANGING_COUNT[reading.changingCount] ?? FATE_BY_CHANGING_COUNT[0]}`,
    `上卦「${benGua.upper}」主外势，下卦「${benGua.lower}」主内应；内外相济则「${zhiGua.name}」之果可期。`,
  ];

  return {
    hexagramName: benGua.name,
    judgmentDigest: digestJudgment(benGua.judgment),
    changingLineReadings: readingVerses(casting),
    plotHints,
    fateHints,
  };
}

/** 引导卡 → 注入 **system 段** 的结构化文本 */
export function renderGuideText(card: GuideCard): string {
  const lines: string[] = [
    "易经卦象引导：",
    `- 本卦：${card.hexagramName}`,
    `- 卦辞：${card.judgmentDigest}`,
  ];
  if (card.changingLineReadings.length > 0) {
    lines.push("- 应变经文：");
    for (const verse of card.changingLineReadings) {
      lines.push(`  · ${verse}`);
    }
  }
  lines.push("- 剧情提示：");
  for (const hint of card.plotHints) {
    lines.push(`  · ${hint}`);
  }
  lines.push("- 宿命提示：");
  for (const hint of card.fateHints) {
    lines.push(`  · ${hint}`);
  }
  return lines.join("\n");
}

/**
 * 评审 rubric 源（stage-06 T2）
 *
 * 职责：定义四维子维度与分档锚点，并组装**内联 rubric** 的评审 system prompt
 * （强制 JSON 输出说明）。版本常量 `REVIEW_RUBRIC_VERSION` 与 `docs/review-rubric.md` 保持一致。
 */

import type { ReviewDimension } from "./types";

/** rubric 版本（与 `docs/review-rubric.md` 版本头一致） */
export const REVIEW_RUBRIC_VERSION = "1.0.0";

/** 单维 rubric：子维度 + 分档锚点 */
export interface DimensionRubric {
  dimension: ReviewDimension;
  subDimensions: string[];
  anchors: { range: string; label: string; desc: string }[];
}

/** 四档分档（0–59 不合格 / 60–79 合格 / 80–89 良 / 90–100 优） */
export const RUBRIC_BANDS = [
  { range: "0-59", label: "不合格" },
  { range: "60-79", label: "合格" },
  { range: "80-89", label: "良" },
  { range: "90-100", label: "优" },
] as const;

/** 各档锚点描述（供 prompt 与文档解释） */
const ANCHOR_DESCRIPTIONS: Record<string, string> = {
  "0-59": "存在硬伤（逻辑断裂 / 设定冲突 / 违规 / 严重套话），建议重写",
  "60-79": "基本达标，尚有明显可改进项",
  "80-89": "良好，仅少量可改进项",
  "90-100": "优秀，几乎无明显问题",
};

/** 分档锚点（含描述） */
export const RUBRIC_ANCHORS: { range: string; label: string; desc: string }[] = RUBRIC_BANDS.map(
  (b) => ({
    range: b.range,
    label: b.label,
    desc: ANCHOR_DESCRIPTIONS[b.range] ?? "",
  }),
);

/** 四维子维度表（plan v2 L53-59） */
export const RUBRICS: Record<ReviewDimension, DimensionRubric> = {
  plot: {
    dimension: "plot",
    subDimensions: ["逻辑连贯", "冲突推进", "节奏", "伏笔呼应"],
    anchors: RUBRIC_ANCHORS,
  },
  worldview: {
    dimension: "worldview",
    subDimensions: ["设定自洽", "术语一致", "环境可信"],
    anchors: RUBRIC_ANCHORS,
  },
  compliance: {
    dimension: "compliance",
    subDimensions: ["涉政", "色情", "暴力", "广告", "价值观"],
    anchors: RUBRIC_ANCHORS,
  },
  humanity: {
    dimension: "humanity",
    subDimensions: ["套话密度", "句式单调", "情感空洞", "信息密度"],
    anchors: RUBRIC_ANCHORS,
  },
};

/** 组装评审 system prompt（内联 rubric + 强制 JSON 输出说明） */
export function buildReviewSystemPrompt(dimension: ReviewDimension): string {
  const rubric = RUBRICS[dimension];
  const bands = RUBRIC_BANDS.map(
    (b) => `- ${b.range} ${b.label}：${ANCHOR_DESCRIPTIONS[b.range]}`,
  ).join("\n");
  return [
    `你是中文小说评审员，从「${dimension}」维度评审用户提供的正文片段。`,
    `rubric 版本：${REVIEW_RUBRIC_VERSION}`,
    "",
    "子维度：" + rubric.subDimensions.join(" / "),
    "",
    "分档：",
    bands,
    "",
    "输出要求：只输出如下 JSON（不得包含解释、Markdown 围栏之外的任何文字）：",
    `{"score": <0-100 的整数>, "reasons": ["判据1", "判据2"], "findings": {"dimension": "${dimension}", "subDimensions": [{"name": "<子维度>", "verdict": "<一句话>"}]}}`,
    "- score 必须落在 0–100 的整数区间；",
    "- reasons 为中文简要判据（逐条对应问题或优点）；",
    "- 温度固定为 0，逐条对照子维度后给出结论。",
  ].join("\n");
}

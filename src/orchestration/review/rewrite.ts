/**
 * 重写 prompt 构造与非流式重写（stage-06 T4）
 *
 * 职责：把上一轮**未通过维度的结构化反馈**（`score` + `reasons`）注入重写 prompt，
 * 并以 stage-03 `ModelProvider` **非流式收口**（聚合全文）得到改写后的正文。
 * 反馈注入使得「保留原意 + 改进反馈项」可被模型逐条对照。
 */

import type { ChatMessage, ModelProvider } from "@/orchestration/types";
import type { ReviewDimension } from "./types";
import { trimReviewContent } from "./budget";

/** 未通过维度的结构化反馈 */
export interface FailedDimensionFeedback {
  dimension: ReviewDimension;
  score: number;
  reasons: string[];
}

export interface RewriteInput {
  content: string;
  feedback: FailedDimensionFeedback[];
  instruction?: string;
}

/** 维度中文名（仅用于 prompt 可读性） */
const DIMENSION_LABELS: Record<ReviewDimension, string> = {
  plot: "剧情",
  worldview: "世界观",
  compliance: "合规",
  humanity: "真人感",
};

/** 构造重写 messages：正文 + 结构化反馈（未通过维度 score+reasons）+ 要求 */
export function buildRewriteMessages(input: RewriteInput): ChatMessage[] {
  const system = [
    "你是中文小说改稿助手。在**保留原意与既有设定**的前提下，针对下列评审反馈逐项改进正文。",
    "要求：",
    "1. 只输出改写后的正文（HTML 片段，段落用 <p> 包裹），不要输出解释文字或 Markdown 围栏；",
    "2. 反馈未提及的部分保持稳定，不得引入与既有设定冲突的内容；",
    "3. 逐条对照反馈，确保被指出的问题在改写稿中不再出现。",
  ].join("\n");

  const feedbackLines = input.feedback.map((item) => {
    const reasons = item.reasons.length > 0 ? item.reasons.join("；") : "（无明细）";
    return `- [${item.dimension}] ${DIMENSION_LABELS[item.dimension]}：score=${item.score}；问题：${reasons}`;
  });

  const user = [
    "【待改正文】",
    // 待改正文按预算裁剪（沿用装配预算；长章不全量送模型）
    trimReviewContent(input.content),
    "",
    "【上一轮评审未通过项】",
    ...feedbackLines,
    "",
    `【本轮要求】${input.instruction ?? "按上述反馈逐项改进，保持原意。"}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** 非流式重写：聚合 `provider.stream` 全文后返回（去首尾空白） */
export async function rewriteChapter(opts: {
  provider: ModelProvider;
  model: string;
  rewrite: RewriteInput;
  temperature?: number;
}): Promise<string> {
  const messages = buildRewriteMessages(opts.rewrite);
  let full = "";
  // 非流式收口：聚合全部增量
  for await (const chunk of opts.provider.stream({
    model: opts.model,
    messages,
    temperature: opts.temperature ?? 0,
  })) {
    full += chunk.delta;
  }
  return full.trim();
}

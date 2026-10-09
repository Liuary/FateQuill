/**
 * 多模型交叉判断与摘取（stage-07 T2）
 *
 * 职责：
 * - `extractFlavorExcerpts`：单模型摘取「AI 味」原文片段（LLM-as-judge，**非流式收口**；JSON 容错复用
 *   `@/orchestration/review/json` 的 `extractJson`）；
 * - `mergeByExcerpt`：以模型返回的**原文引文（verbatim excerpt）为键求精确交集**，
 *   命中模型数 **≥2 → 高置信**、**=1 → 待人工确认**；**不做模糊对齐**（v0.2 简化）。
 *
 * **不入库**：本模块只返回结果；交叉结果由调用方放入**会话内存待确认队列**
 * （`researchStore.pendingResults`），用户确认后才入库（`status=confirmed`）。
 */

import type { ModelProvider } from "@/orchestration/types";
import { extractJson } from "@/orchestration/review/json";
import type { CrossJudgeResult, ModelExcerpts } from "./types";

/** 摘取 prompt（要求 JSON：`{"excerpts":[{"excerpt","reason"}]}`） */
const EXCERPT_SYSTEM_PROMPT =
  "你是中文小说文本分析助手。请从用户给出的正文中，摘出**被人为判定为「AI 味」的原文片段**（逐字原文，不得改写）。" +
  "只输出如下 JSON，不要解释、不要 Markdown 围栏之外的内容：" +
  '{"excerpts":[{"excerpt":"<逐字原文片段>","reason":"<为何有 AI 味>"}]}';

/** 解析摘取 JSON；非法抛错（由调用方决定是否逐模型容错） */
function parseExcerpts(full: string): { excerpt: string; reason: string }[] {
  const data: unknown = JSON.parse(extractJson(full));
  if (typeof data !== "object" || data === null) {
    throw new Error("invalid excerpt payload");
  }
  const raw = (data as { excerpts?: unknown }).excerpts;
  if (!Array.isArray(raw)) {
    throw new Error("invalid excerpt list");
  }
  return raw
    .filter(
      (item): item is { excerpt?: unknown; reason?: unknown } =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      excerpt: String((item as { excerpt?: unknown }).excerpt ?? "").trim(),
      reason: String((item as { reason?: unknown }).reason ?? ""),
    }))
    .filter((item) => item.excerpt.length > 0);
}

/** 单模型摘取 AI 味片段（LLM-as-judge，非流式收口；`model` 同时作为来源标识） */
export async function extractFlavorExcerpts(opts: {
  provider: ModelProvider;
  model: string;
  content: string;
  temperature?: number;
}): Promise<ModelExcerpts> {
  let full = "";
  // 非流式收口：聚合全部增量后再解析
  for await (const chunk of opts.provider.stream({
    model: opts.model,
    temperature: opts.temperature ?? 0,
    messages: [
      { role: "system", content: EXCERPT_SYSTEM_PROMPT },
      { role: "user", content: opts.content },
    ],
  })) {
    full += chunk.delta;
  }
  return { model: opts.model, excerpts: parseExcerpts(full) };
}

/**
 * 交叉合并：以 **verbatim 引文精确交集**为键聚合各模型命中。
 * - 命中模型数 **≥2 → `high`**（模型共识）；**=1 → `pending`**（待人工确认）；
 * - **不做模糊对齐**（大小写 / 空白不自动归一，v0.2 简化）；
 * - 每项携带 `sourceType = "multi_model_cross"`（REV-011）。
 */
export function mergeByExcerpt(results: ModelExcerpts[]): CrossJudgeResult[] {
  const merged = new Map<string, { models: Set<string>; reasons: Set<string> }>();
  for (const result of results) {
    for (const item of result.excerpts) {
      const entry = merged.get(item.excerpt) ?? {
        models: new Set<string>(),
        reasons: new Set<string>(),
      };
      entry.models.add(result.model);
      if (item.reason) {
        entry.reasons.add(item.reason);
      }
      merged.set(item.excerpt, entry);
    }
  }

  const out: CrossJudgeResult[] = [];
  for (const [excerpt, entry] of merged) {
    const models = [...entry.models];
    out.push({
      excerpt,
      // 定位提示 = 引文本身（T3 以此在正文中 verbatim 检索定位）
      positionHint: excerpt,
      models,
      reason: [...entry.reasons].join("；"),
      confidence: models.length >= 2 ? "high" : "pending",
      sourceType: "multi_model_cross",
    });
  }
  return out;
}

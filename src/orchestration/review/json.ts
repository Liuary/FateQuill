/**
 * 审查评分 JSON 解析容错（stage-06 T1）
 *
 * 职责：从 LLM 原始输出中提取候选 JSON（去围栏 / 夹取）并归一化为 `EvaluationResult`。
 * 非法输入一律**抛错**，交由上层 `evaluateWithFallback` 做有限重试与降级（不在此静默吞错）。
 */

import type { EvaluationResult } from "./types";

/** 从原始文本提取候选 JSON（去 ```json 围栏 / 取首 `{` 至末 `}`） */
export function extractJson(raw: string): string {
  const text = raw.trim();
  // 优先：```json ... ``` / ``` ... ``` 围栏内容
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1].trim()) {
    return fenced[1].trim();
  }
  // 其次：夹取首个 '{' 至末个 '}'
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

/** 解析并归一化评估 JSON：score 夹取 0–100；reasons 归一为 string[]；非法抛错（交上层降级） */
export function parseEvaluationJson(raw: string): EvaluationResult {
  const candidate = extractJson(raw);
  let data: unknown;
  try {
    data = JSON.parse(candidate);
  } catch {
    // JSON 语法非法（含空串）：抛错交上层降级
    throw new Error("invalid evaluation JSON");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    // 顶层非对象：无法解释为评估结果
    throw new Error("invalid evaluation payload");
  }
  const obj = data as Record<string, unknown>;
  const rawScore = obj.score;
  if (typeof rawScore !== "number" || !Number.isFinite(rawScore)) {
    // score 缺失 / 非有限数字：视为非法
    throw new Error("invalid evaluation score");
  }
  const result: EvaluationResult = {
    score: Math.min(100, Math.max(0, rawScore)),
    reasons: normalizeReasons(obj.reasons),
  };
  if (obj.findings !== undefined) {
    result.findings = obj.findings;
  }
  return result;
}

/** reasons 归一为 string[]：数组逐项字符串化；字符串按换行/分号切分；其它置空数组 */
function normalizeReasons(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== null && v !== undefined)
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|;|；/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

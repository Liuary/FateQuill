/**
 * 归档抽取（stage-11 T2）
 *
 * 职责：**手动「归档本章」**的 LLM 抽取——由章节正文抽取候选设定
 * （`{name,kind,suggestedTier,content,evidence}`），并做 **`evidence` 原文回查**（子串断言，防幻觉硬闸）。
 * 非流式收口（同 stage-08/10）；JSON 容错复用 `@/orchestration/review/json` 的 `extractJson`。
 *
 * **局限声明（v0.5）**：别名 / 语义相似去重**显式不做**（仅名称精确匹配，见 `dedupe.ts`）。
 */

import type { ChatOptions, ModelRef } from "@/orchestration/types";
import { extractJson } from "@/orchestration/review/json";
import { SETTING_CARD_TIERS, type SettingCardTier } from "@/domain/models/setting-card";
import type { ExtractedSetting } from "./types";

/** 抽取输出契约（system 段；JSON 结构 + 约束说明） */
export const EXTRACTION_SYSTEM_PROMPT = [
  "你是简体中文长篇小说的设定归档助手。请从给定章节正文中抽取**新出现的设定**（世界观规则、地理、组织、物品、人物身份等）。",
  "要求：",
  "1. 只输出如下 JSON，不要输出解释文字：",
  '{"settings":[{"name":"<设定名称>","kind":"<类型>","suggestedTier":"main|dark|short|temp","content":"<设定内容>","evidence":"<原文逐字片段>"}]}',
  "2. `evidence` 必须是**正文中逐字出现的片段**（不改写、不拼接；用于原文回查，无法逐字对应的条目会被丢弃）；",
  "3. `suggestedTier` 取四级之一：`main`（贯穿全书核心约定）/ `dark`（隐藏设定，尚未揭示）/ `short`（近期章节有效）/ `temp`（一次性细节）；",
  "4. `kind` 用简短中文类别（如「世界观」「地理」「组织」「物品」「身份」）；",
  '5. 只抽取**本章新出现**的设定；不要重复已知设定；没有则输出 `{"settings":[]}`。',
].join("\n");

/** 章节 HTML → 纯文本（抽取与**回查用同一文本**，保证 `evidence` 可逐字匹配） */
export function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 规范化空白（回查比较用：折叠连续空白并去首尾） */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 构造抽取 `ChatOptions`（system = 输出契约；user = 章节正文） */
export function buildExtractOptions(input: {
  chapterText: string;
  modelRef: ModelRef;
  temperature?: number;
}): ChatOptions {
  return {
    model: input.modelRef.model,
    temperature: input.temperature ?? 0.3,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: `【本章正文】\n${input.chapterText}` },
    ],
  };
}

/** `suggestedTier` 归一：合法四级 → 原值；未知 / 缺失 → `short`（缺省保守） */
function normalizeTier(value: unknown): SettingCardTier {
  return typeof value === "string" && (SETTING_CARD_TIERS as readonly string[]).includes(value)
    ? (value as SettingCardTier)
    : "short";
}

/**
 * 解析抽取 JSON：JSON 容错（去围栏 / 夹取）。
 * - 顶层非对象 / `settings` 非数组 / JSON 语法非法 → **抛错**（由 `runExtraction` 收为 `ok:false`）；
 * - 单条候选**缺 `name` 或 `evidence`** → **丢弃**（该条非法，不影响其余）。
 */
export function parseExtraction(raw: string): ExtractedSetting[] {
  const data: unknown = JSON.parse(extractJson(raw));
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("invalid extraction payload");
  }
  const settings = (data as { settings?: unknown }).settings;
  if (!Array.isArray(settings)) {
    throw new Error("invalid extraction settings");
  }
  const out: ExtractedSetting[] = [];
  for (const item of settings) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue; // 非对象条目：丢弃
    }
    const source = item as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const evidence = typeof source.evidence === "string" ? source.evidence.trim() : "";
    if (!name || !evidence) {
      continue; // 缺名称 / 缺回查依据：丢弃（防幻觉前置）
    }
    out.push({
      name,
      kind: typeof source.kind === "string" ? source.kind.trim() : "",
      suggestedTier: normalizeTier(source.suggestedTier),
      content: typeof source.content === "string" ? source.content.trim() : "",
      evidence,
    });
  }
  return out;
}

/**
 * **原文回查**（防幻觉硬闸）：规范化空白后断言 `evidence` 为 `chapterText` 的**子串**。
 * 不满足 → `false`（调用方**剔除**该候选）。
 */
export function verifyEvidence(candidate: ExtractedSetting, chapterText: string): boolean {
  const evidence = normalizeWhitespace(candidate.evidence);
  if (!evidence) {
    return false;
  }
  return normalizeWhitespace(chapterText).includes(evidence);
}

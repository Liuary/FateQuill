/**
 * 候选去重（stage-11 T2）
 *
 * 口径：**名称精确匹配**既有设定卡（trim 后全等）→ `status:"duplicate"`（**不重复建卡**）。
 *
 * **局限声明（v0.5）**：别名 / 简称 / 语义相似去重**显式不做**（留后续阶段）；
 * 大小写差异视为不同名称（不改写用户命名）。
 */

import type { ExtractedSetting, ExtractionCandidate } from "./types";

/** 名称列表归一（trim + 去空） */
function normalizeNames(names: string[]): Set<string> {
  return new Set(names.map((name) => name.trim()).filter(Boolean));
}

/** 与既有卡名称精确比对 → 标注 `new` / `duplicate`（`evidenceVerified` 沿用回查通过事实） */
export function dedupeByName(
  candidates: ExtractedSetting[],
  existingNames: string[],
): ExtractionCandidate[] {
  const existing = normalizeNames(existingNames);
  return candidates.map((candidate) => ({
    ...candidate,
    status: existing.has(candidate.name.trim()) ? "duplicate" : "new",
    evidenceVerified: true,
  }));
}

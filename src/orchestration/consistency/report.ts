/**
 * 冲突报告装配（stage-11 T3）
 *
 * 职责：L1 报告与 L2 语义结论 → **统一报告列表**（`ConflictReport`），并做 `(aId,bId,type)` **去重**；
 * 提供严重度定级与**误报率阈值占位常量**。
 */

import type { ConflictReport, ConflictSeverity, ConflictType, JudgeVerdict } from "./types";

/**
 * 误报率阈值（**占位，待用户拍板**）：标注样本集上「误报数 / 报出总数 ≤ X」。
 * 建议默认 20%（plan v2 待拍板项 ①）；拍板后调整本常量。
 */
export const MISREPORT_THRESHOLD = 0.2;

/** L2 语义结论配对（候选 ↔ 约束卡） */
export interface SemanticFinding {
  candidateId: number;
  constraintId: number;
  verdict: JudgeVerdict;
}

/** 类型 + L2 结论 → 严重度（生命周期 > 时间线 > 语义 > 数值） */
export function severityOf(
  type: ConflictType,
  verdict?: JudgeVerdict["verdict"],
): ConflictSeverity {
  switch (type) {
    case "life-status":
      return "high";
    case "timeline":
      return "medium";
    case "semantic":
      // 语义冲突仅在**明确矛盾**时升为 medium；其余（疑似）保持 low
      return verdict === "contradiction" ? "medium" : "low";
    default:
      return "low";
  }
}

/** 报告去重键（同设定对 + 同类型视为同一条） */
const keyOf = (report: ConflictReport): string => `${report.aId}|${report.bId}|${report.type}`;

/** 报告去重（保留首次出现者；顺序稳定） */
export function dedupeReports(reports: ConflictReport[]): ConflictReport[] {
  const seen = new Set<string>();
  const out: ConflictReport[] = [];
  for (const report of reports) {
    const key = keyOf(report);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(report);
  }
  return out;
}

/**
 * L1 报告 + L2 语义结论 → 合并报告：
 * - **仅 `contradiction`** 的语义结论转报告（`type: "semantic"`，evidence 取 verdict.evidence / reason）；
 * - `consistent` / `uncertain` **不产出报告**（建议非结论、不误报）；
 * - 合并后按 `(aId,bId,type)` **去重**。
 */
export function toConflictReport(
  l1Reports: ConflictReport[],
  semantics: SemanticFinding[],
): ConflictReport[] {
  const semanticReports: ConflictReport[] = semantics
    .filter((finding) => finding.verdict.verdict === "contradiction")
    .map((finding) => ({
      aId: Math.min(finding.candidateId, finding.constraintId),
      bId: Math.max(finding.candidateId, finding.constraintId),
      type: "semantic",
      evidence: finding.verdict.evidence ?? finding.verdict.reason,
      severity: severityOf("semantic", finding.verdict.verdict),
    }));
  return dedupeReports([...l1Reports, ...semanticReports]);
}

/**
 * 全自动**决策规则表**（stage-12 T2）
 *
 * **纯函数**（无 IO、无 provider、可单测）：每一环节的自动判定皆集中于此，便于审查与替换。
 * 决策项：推演择优（加权总分最高）→ 是否重写（轮数 + 阈值）→ 降级标记 → 归档是否自动确认。
 */

import type { AutopilotConfig, ChapterOutcome } from "./types";

/** 待择优的分支（已带审查加权总分） */
export interface BranchScore {
  id: string;
  /** 审查加权总分（未评分为缺省） */
  total?: number;
}

/**
 * 推演择优：取**审查加权总分最高**者；同分取先出现者（稳定）；
 * 全部分支未评分（`total` 缺省）→ `null`（回退为「无推演直接生成」）。
 */
export function pickBranch(branches: BranchScore[]): BranchScore | null {
  const scored = branches.filter(
    (branch): branch is BranchScore & { total: number } =>
      typeof branch.total === "number" && Number.isFinite(branch.total),
  );
  if (scored.length === 0) {
    return null;
  }
  return scored.reduce((best, current) => (current.total > best.total ? current : best));
}

/** 是否继续重写：**未达阈值**且**轮数未用尽** */
export function shouldRewrite(
  score: number,
  passThreshold: number,
  round: number,
  maxRewriteRounds: number,
): boolean {
  return score < passThreshold && round < maxRewriteRounds;
}

/** 降级标记（**不阻塞续跑**）：原因必填，供报告与人工复核 */
export function markDegraded(reason: string): { degraded: true; degradedReason: string } {
  return { degraded: true, degradedReason: reason };
}

/** 归档是否**自动确认**入库（false → 候选仅入待确认队列，留人工） */
export function shouldAutoConfirmArchive(config: AutopilotConfig): boolean {
  return config.autoConfirmArchive === true;
}

/** 章结果：达阈（未降级）统计 */
export function isPassed(chapter: ChapterOutcome, passThreshold: number): boolean {
  return !chapter.degraded && typeof chapter.score === "number" && chapter.score >= passThreshold;
}

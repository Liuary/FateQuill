/**
 * 产出期偏离标注收敛器（stage-08 T3，纯函数）
 *
 * 「克制收敛」的**第二层**：以**设定卡覆盖检查**为判据（含**存在性校验**：过滤幻觉引用），
 * 对偏离分支**仅降权 + 标注**（**不过滤、不删除**，保持可对比）；**终选权归用户**。
 */

import type { ExplorationBranch } from "./types";

export interface ConvergeOptions {
  /** 本次生成**注入**的设定卡 id 集（system 段约束） */
  injectedSettingCardIds: number[];
  /** **存在性校验基准**：该作品全部设定卡 id */
  existingSettingCardIds: Set<number>;
  /** 覆盖率阈值（默认 0.5） */
  coverageThreshold?: number;
  /** 可选贴合度（分支 id → 0–1）；**缺省不启用**（stage-06 评审管线软依赖） */
  fitScores?: Record<string, number>;
}

export const DEFAULT_COVERAGE_THRESHOLD = 0.5;

/**
 * 收敛：覆盖检查 + 存在性校验（过滤幻觉 id）+ 降权。
 *
 * 返回**更新后的分支列表（数量与输入一致：不过滤、不删除）**；展示顺序由调用方按 `weight` 降序决定。
 */
export function converge(
  branches: ExplorationBranch[],
  opts: ConvergeOptions,
): ExplorationBranch[] {
  const threshold = opts.coverageThreshold ?? DEFAULT_COVERAGE_THRESHOLD;
  const injected = [...new Set(opts.injectedSettingCardIds)];

  return branches.map((branch) => {
    if (!branch.card) {
      return { ...branch }; // 无走向卡（pending/error）：不参与收敛
    }

    const referenced = [...new Set(branch.card.settingCardIds)];
    // 存在性校验：不在作品设定卡集中的 id 视为**幻觉引用**（过滤 + 记录）
    const validRefs = referenced.filter((id) => opts.existingSettingCardIds.has(id));
    const invalidSettingCardIds = referenced.filter((id) => !opts.existingSettingCardIds.has(id));
    const missingSettingCardIds = validRefs.filter((id) => !injected.includes(id));

    // 覆盖率 = 有效引用 ∩ 注入集 / 注入集（无注入时视为 1：无约束可偏离）
    const coverage =
      injected.length === 0
        ? 1
        : validRefs.filter((id) => injected.includes(id)).length / injected.length;

    const fitScore = opts.fitScores?.[branch.id];
    const flagged =
      coverage < threshold ||
      invalidSettingCardIds.length > 0 ||
      (fitScore !== undefined && fitScore < threshold);

    // 「削弱」= 排序降权（**不删不改**）
    // 边界（REV-008③）：`flagged && coverage=1` → weight 0.5 与 `!flagged && coverage=0.5` → weight 0.5
    // 可能并列；v0.3 **接受**（偏离通常另有 invalid/fitScore 触发；并列时按温度序稳定排序），
    // 不额外引入权重维度。
    const weight = flagged ? coverage * 0.5 : coverage;

    return {
      ...branch,
      card: { ...branch.card, settingCardIds: validRefs }, // 过滤后的引用（幻觉 id 移除）
      deviation: {
        flagged,
        coverage,
        invalidSettingCardIds,
        missingSettingCardIds,
        ...(fitScore !== undefined ? { fitScore } : {}),
      },
      weight,
    };
  });
}

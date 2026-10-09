/**
 * 推演成本预估（stage-08 T5）
 *
 * 口径：**预估 = 分支数 ×（输出上限 + 单分支输入估算）**。
 * 输入侧按 **N 倍**估算（装配上下文在**每个分支**全量重复发送，REV-008①）。
 */

/** 默认输出 token 上限（成本预估基数） */
export const OUTPUT_TOKEN_LIMIT_DEFAULT = 2048;

/** 默认单分支输入 token 估算（装配上下文每分支重复发送） */
export const INPUT_TOKENS_PER_BRANCH_DEFAULT = 1024;

export interface CostEstimate {
  /** 预估总 token 数 */
  tokens: number;
  /** 口径说明（**输入为估算**） */
  note: string;
}

/** 成本预估 = 分支数 ×（输出上限 + 单分支输入估算） */
export function estimateCost(
  branchCount: number,
  opts?: { outputLimit?: number; inputTokensPerBranch?: number },
): CostEstimate {
  const outputLimit = opts?.outputLimit ?? OUTPUT_TOKEN_LIMIT_DEFAULT;
  const inputTokensPerBranch = opts?.inputTokensPerBranch ?? INPUT_TOKENS_PER_BRANCH_DEFAULT;
  const perBranch = outputLimit + inputTokensPerBranch;
  return {
    tokens: Math.max(0, Math.trunc(branchCount)) * perBranch,
    note: `预估 = 分支数 ×（输出上限 ${outputLimit} + 输入估算 ${inputTokensPerBranch}）`,
  };
}

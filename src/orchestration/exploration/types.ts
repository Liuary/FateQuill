/**
 * 多温度并行推演契约（stage-08 T1）
 *
 * 走向卡 = 推演分支的结构化产出；分支 = 同模型 × 一个温度（首版同模型多温度，跨模型留待后续）。
 */

/** 走向卡（一条可能发展路线的结构化摘要） */
export interface TurnCard {
  /** 走向摘要 */
  summary: string;
  /** 关键转折点 */
  keyTurns: string[];
  /** 涉及的设定卡 id（引用既有设定卡） */
  settingCardIds: number[];
}

/** 分支状态 */
export type BranchStatus = "pending" | "done" | "error";

/** 推演分支（同模型 × 一个温度） */
export interface ExplorationBranch {
  id: string;
  /** 请求温度 */
  temperature: number;
  /** clamp 后实际下发温度 */
  effectiveTemperature: number;
  /** 是否被 provider 区间 clamp（UI 标注） */
  clamped: boolean;
  status: BranchStatus;
  card?: TurnCard;
  error?: string;
}

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

/** 偏离标注（产出期收敛结果；**仅标注 + 降权，不过滤不删除**） */
export interface BranchDeviation {
  /** 是否判定为偏离（低覆盖 / 幻觉引用 / 低贴合度） */
  flagged: boolean;
  /** 设定卡覆盖率 0–1（有效引用 ∩ 注入集 / 注入集） */
  coverage: number;
  /** 幻觉引用（不在该作品设定卡集中）——已从 `card.settingCardIds` 过滤 */
  invalidSettingCardIds: number[];
  /** 缺失引用（存在但**未注入**本次生成） */
  missingSettingCardIds: number[];
  /** 可选贴合度（`< coverageThreshold` → 计入偏离；缺省不启用） */
  fitScore?: number;
}

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
  /** 偏离标注（收敛后写入） */
  deviation?: BranchDeviation;
  /** 收敛权重（降序排序用；收敛前为 undefined） */
  weight?: number;
}

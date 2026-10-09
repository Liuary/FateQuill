/** 审查记录（每维一行）；stage-06 T6 持久化 */
export interface ReviewRecord {
  id: number;
  chapterId: number;
  /** 审查轮次（0 = 初版；1..n = 重写轮次） */
  round: number;
  /** 维度 id（`plot` / `worldview` / `compliance` / `humanity`） */
  dimension: string;
  /** 评分 0–100 */
  score: number;
  /** 判定理由（由 `reasons_json` 反序列化） */
  reasons: string[];
  createdAt: string;
}

import type { ReviewRecord } from "@/domain/models/review-record";

/** 审查记录仓储接口（TS；实现见 `src/ipc/repositories`） */
export interface ReviewRecordRepository {
  /** 保存一条审查记录（每维一行） */
  save(input: {
    chapterId: number;
    round: number;
    dimension: string;
    score: number;
    reasons: string[];
  }): Promise<ReviewRecord>;

  /** 按章查询审查历史（时间倒序） */
  listByChapter(chapterId: number): Promise<ReviewRecord[]>;
}

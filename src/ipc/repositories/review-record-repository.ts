import { invokeCommand } from "@/ipc/client";
import type { ReviewRecord } from "@/domain/models/review-record";
import type { ReviewRecordRepository } from "@/domain/repositories/review-record-repository";

/** 后端行（snake_case）；`reasons_json` 为 JSON 文本 */
interface ReviewRecordRow {
  id: number;
  chapter_id: number;
  round: number;
  dimension: string;
  score: number;
  reasons_json: string;
  created_at: string;
}

/** `reasons_json` → 字符串数组；非法 JSON 归一为空数组（不阻断列表） */
function parseReasons(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

const toReviewRecord = (row: ReviewRecordRow): ReviewRecord => ({
  id: row.id,
  chapterId: row.chapter_id,
  round: row.round,
  dimension: row.dimension,
  score: row.score,
  reasons: parseReasons(row.reasons_json),
  createdAt: row.created_at,
});

/** 基于 IPC 命令实现的审查记录仓储（`reasons_json` ↔ `reasons` 映射） */
export function createReviewRecordRepository(): ReviewRecordRepository {
  return {
    async save(input) {
      return toReviewRecord(
        await invokeCommand<ReviewRecordRow>("save_review_record", {
          chapterId: input.chapterId,
          round: input.round,
          dimension: input.dimension,
          score: input.score,
          reasons: input.reasons,
        }),
      );
    },
    async listByChapter(chapterId) {
      const rows = await invokeCommand<ReviewRecordRow[]>("list_review_records", { chapterId });
      return rows.map(toReviewRecord);
    },
  };
}

import type { ConflictSeverity, ConflictType } from "@/orchestration/consistency/types";
import type { ConflictDispositionAction, ConflictRecord } from "@/domain/models/conflict-record";

/** 冲突记录仓储接口（TS 实现见 `src/ipc/repositories`） */
export interface ConflictRecordRepository {
  /** 落库一条冲突记录（跨会话可查） */
  save(input: {
    novelId: number;
    aId: number;
    bId: number;
    type: ConflictType;
    evidence: string;
    severity: ConflictSeverity;
  }): Promise<ConflictRecord>;

  /** 按作品列出（最新在前） */
  listByNovel(novelId: number): Promise<ConflictRecord[]>;

  get(id: number): Promise<ConflictRecord>;

  /** 处置：`change_tier`/`edit` → `resolved`；`false_positive`/`ignore` → `ignored`（均留痕 `action`） */
  resolve(id: number, action: ConflictDispositionAction): Promise<ConflictRecord>;

  remove(id: number): Promise<void>;
}

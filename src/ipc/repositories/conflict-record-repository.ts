import { invokeCommand } from "@/ipc/client";
import type {
  ConflictDispositionAction,
  ConflictRecord,
  ConflictRecordStatus,
} from "@/domain/models/conflict-record";
import type { ConflictSeverity, ConflictType } from "@/orchestration/consistency/types";
import type { ConflictRecordRepository } from "@/domain/repositories/conflict-record-repository";

/** 后端行（snake_case；冲突类型列名为 `type`） */
interface ConflictRecordRow {
  id: number;
  novel_id: number;
  a_id: number;
  b_id: number;
  type: string;
  evidence: string;
  severity: string;
  status: string;
  action: string;
  created_at: string;
  resolved_at: string | null;
}

const toConflictRecord = (row: ConflictRecordRow): ConflictRecord => ({
  id: row.id,
  novelId: row.novel_id,
  aId: row.a_id,
  bId: row.b_id,
  type: row.type as ConflictType,
  evidence: row.evidence,
  severity: row.severity as ConflictSeverity,
  status: row.status as ConflictRecordStatus,
  action: row.action,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
});

/** 基于 IPC 命令实现的冲突记录仓储（snake_case ↔ camelCase 映射） */
export function createConflictRecordRepository(): ConflictRecordRepository {
  return {
    async save(input) {
      return toConflictRecord(
        await invokeCommand<ConflictRecordRow>("save_conflict_record", {
          novelId: input.novelId,
          aId: input.aId,
          bId: input.bId,
          // Rust 侧参数名避关键字：`conflict_type` → 前端 `conflictType`（SQL 列仍为 `type`）
          conflictType: input.type,
          evidence: input.evidence,
          severity: input.severity,
        }),
      );
    },
    async listByNovel(novelId) {
      const rows = await invokeCommand<ConflictRecordRow[]>("list_conflict_records", { novelId });
      return rows.map(toConflictRecord);
    },
    async get(id) {
      return toConflictRecord(
        await invokeCommand<ConflictRecordRow>("get_conflict_record", { id }),
      );
    },
    async resolve(id, action: ConflictDispositionAction) {
      return toConflictRecord(
        await invokeCommand<ConflictRecordRow>("resolve_conflict_record", { id, action }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_conflict_record", { id });
    },
  };
}

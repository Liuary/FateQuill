import { invokeCommand } from "@/ipc/client";
import type {
  AutopilotChapter,
  AutopilotChapterState,
  AutopilotRun,
  AutopilotRunStatus,
} from "@/domain/models/autopilot";
import type { AutopilotRepository } from "@/domain/repositories/autopilot-repository";

/** 后端行（snake_case） */
interface AutopilotRunRow {
  id: number;
  novel_id: number;
  status: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

interface AutopilotChapterRow {
  id: number;
  run_id: number;
  chapter_id: number | null;
  order_index: number;
  state: string;
  score: number | null;
  degraded_reason: string;
  attempt: number;
  updated_at: string;
}

const toRun = (row: AutopilotRunRow): AutopilotRun => ({
  id: row.id,
  novelId: row.novel_id,
  status: row.status as AutopilotRunStatus,
  configJson: row.config_json,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toChapter = (row: AutopilotChapterRow): AutopilotChapter => ({
  id: row.id,
  runId: row.run_id,
  chapterId: row.chapter_id,
  orderIndex: row.order_index,
  state: row.state as AutopilotChapterState,
  score: row.score,
  degradedReason: row.degraded_reason,
  attempt: row.attempt,
  updatedAt: row.updated_at,
});

/** 基于 IPC 命令实现的全自动断点仓储（snake_case ↔ camelCase 映射） */
export function createAutopilotRepository(): AutopilotRepository {
  return {
    async saveRun(input) {
      const args: Record<string, unknown> = {
        novelId: input.novelId,
        status: input.status,
        configJson: input.configJson,
      };
      if (input.id !== undefined) {
        args.id = input.id;
      }
      return toRun(await invokeCommand<AutopilotRunRow>("save_autopilot_run", args));
    },
    async getRun(id) {
      return toRun(await invokeCommand<AutopilotRunRow>("get_autopilot_run", { id }));
    },
    async listRuns(novelId) {
      const rows = await invokeCommand<AutopilotRunRow[]>("list_autopilot_runs", { novelId });
      return rows.map(toRun);
    },
    async saveChapter(input) {
      return toChapter(
        await invokeCommand<AutopilotChapterRow>("save_autopilot_chapter", {
          runId: input.runId,
          chapterId: input.chapterId ?? null,
          orderIndex: input.orderIndex,
          state: input.state,
          score: input.score ?? null,
          degradedReason: input.degradedReason ?? "",
          attempt: input.attempt ?? 0,
        }),
      );
    },
    async listChapters(runId) {
      const rows = await invokeCommand<AutopilotChapterRow[]>("list_autopilot_chapters", { runId });
      return rows.map(toChapter);
    },
  };
}

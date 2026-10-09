import type {
  AutopilotChapter,
  AutopilotChapterState,
  AutopilotRun,
  AutopilotRunStatus,
} from "@/domain/models/autopilot";

/** 全自动断点仓储接口（TS 实现见 `src/ipc/repositories`） */
export interface AutopilotRepository {
  /** **upsert** 一轮（`id` 缺省 → 新建；否则更新状态与配置） */
  saveRun(input: {
    id?: number;
    novelId: number;
    status: AutopilotRunStatus;
    configJson: string;
  }): Promise<AutopilotRun>;

  getRun(id: number): Promise<AutopilotRun>;

  /** 按作品列出（最新在前） */
  listRuns(novelId: number): Promise<AutopilotRun[]>;

  /** **upsert** 单章断点（键 = `runId + orderIndex`） */
  saveChapter(input: {
    runId: number;
    chapterId?: number | null;
    orderIndex: number;
    state: AutopilotChapterState;
    score?: number | null;
    degradedReason?: string;
    attempt?: number;
  }): Promise<AutopilotChapter>;

  /** 按 run 列出章断点（`orderIndex` 升序） */
  listChapters(runId: number): Promise<AutopilotChapter[]>;
}

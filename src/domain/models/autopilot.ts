/**
 * 全自动创作断点（stage-12 T3，迁移 v6）
 *
 * `autopilot_run`（一轮）+ `autopilot_chapter`（单章断点）——**落库可续跑**（中断后重启从断点续）。
 */

/** 轮次状态（与迁移 v6 的 `CHECK` 一致） */
export const AUTOPILOT_RUN_STATUSES = [
  "running",
  "paused",
  "completed",
  "aborted",
  "failed",
] as const;

/** 轮次状态值 */
export type AutopilotRunStatus = (typeof AUTOPILOT_RUN_STATUSES)[number];

/** 章断点状态（与迁移 v6 的 `CHECK` 一致） */
export const AUTOPILOT_CHAPTER_STATES = [
  "pending",
  "running",
  "done",
  "degraded",
  "failed",
] as const;

/** 章断点状态值 */
export type AutopilotChapterState = (typeof AUTOPILOT_CHAPTER_STATES)[number];

/** 全自动一轮（`config_json` 内含 `{ config, outline }`，续跑据此恢复） */
export interface AutopilotRun {
  id: number;
  novelId: number;
  status: AutopilotRunStatus;
  configJson: string;
  createdAt: string;
  updatedAt: string;
}

/** 单章断点（键 = `runId + orderIndex`） */
export interface AutopilotChapter {
  id: number;
  runId: number;
  chapterId: number | null;
  orderIndex: number;
  state: AutopilotChapterState;
  score: number | null;
  degradedReason: string;
  attempt: number;
  updatedAt: string;
}

/** 续跑判定：**已完成章**（`done` / `degraded`）——续跑时**不重跑** */
export function isChapterSettled(chapter: AutopilotChapter): boolean {
  return chapter.state === "done" || chapter.state === "degraded";
}

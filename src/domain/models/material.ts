/**
 * 素材模型（stage-07 T1/T4）
 *
 * `MaterialSourceType` 为**单一来源**（REV-016②）：`orchestration/research` 与 IPC/仓储均引用此处，
 * 避免双处定义漂移。三值与三采集通道一一对应（plan v2 L26/L50）。
 */

/** 素材采集通道（三通道一一对应：多模型创作 / 多模型交叉 / 用户手动） */
export type MaterialSourceType = "multi_model_creation" | "multi_model_cross" | "user_manual";

/**
 * 素材状态。`candidate` 为**预留枚举**（跨会话待确认扩展，REV-013）——
 * 本阶段待确认队列为**会话内存**（`researchStore.pendingResults`），所有入库写路径均为 `confirmed`。
 */
export type MaterialStatus = "candidate" | "confirmed";

/** 素材（AI 味标注结果）；`excerpt` 为引文**唯一权威**（REV-016①） */
export interface Material {
  id: number;
  sourceType: MaterialSourceType;
  sourceModel: string;
  /** 引文原文（verbatim）；**唯一权威**，定位以其为准 */
  excerpt: string;
  /** 定位上下文（**仅上下文**，不含引文本身——引文以 `excerpt` 为准） */
  position: { contextBefore?: string; contextAfter?: string };
  reason: string;
  label: string;
  chapterId: number | null;
  status: MaterialStatus;
  createdAt: string;
}

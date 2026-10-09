/**
 * 素材模型（stage-07 T1 起）
 *
 * `MaterialSourceType` 为**单一来源**（REV-016②）：`orchestration/research` 与 IPC/仓储均引用此处，
 * 避免双处定义漂移。三值与三采集通道一一对应（plan v2 L26/L50）。
 *
 * 注：`MaterialStatus` / `Material` 实体随 T3（用户标注入库，op-004）在本文件补齐。
 */

/** 素材采集通道（三通道一一对应：多模型创作 / 多模型交叉 / 用户手动） */
export type MaterialSourceType = "multi_model_creation" | "multi_model_cross" | "user_manual";

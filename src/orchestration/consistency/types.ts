/**
 * 一致性（归档抽取）契约（stage-11 T2）
 *
 * 抽取输出 `{name, kind, suggestedTier, content, evidence}`——**`evidence` 为原文逐字片段**，
 * 供 **原文回查**（防幻觉硬闸）；候选**不入库直达**，进**会话内存待确认队列**后由用户确认落库。
 */

import type { SettingCardTier } from "@/domain/models/setting-card";

/** LLM 抽取出的单条设定（**未经验证/去重**） */
export interface ExtractedSetting {
  /** 设定名称（去重键；**名称精确匹配**为 v0.5 口径） */
  name: string;
  /** 设定卡类型（`kind`，保持自定义字符串兼容） */
  kind: string;
  /** 建议分级（四级；用户可在待确认队列修正） */
  suggestedTier: SettingCardTier;
  /** 设定内容（入库为 `content`） */
  content: string;
  /** **原文逐字片段**（原文回查依据，防幻觉） */
  evidence: string;
}

/** 待确认候选（回查 + 去重后） */
export interface ExtractionCandidate extends ExtractedSetting {
  /** `new` 可入库 / `duplicate` 与既有卡同名（**不重复建卡**） */
  status: "new" | "duplicate";
  /** `evidence` 通过原文回查（**不匹配者在抽取阶段即剔除**，故存活候选恒为 `true`） */
  evidenceVerified: boolean;
}

/** 抽取运行结果（**失败不抛穿**；零命中为合法空态） */
export interface ExtractionResult {
  ok: boolean;
  candidates: ExtractionCandidate[];
  error?: string;
}

/** 冲突严重度（写入 `conflict_record.severity`） */
export type ConflictSeverity = "high" | "medium" | "low";

/**
 * 冲突类型：
 * - `life-status` / `timeline` / `numeric` → **L1 规则**（结构化断言比对，零幻觉）；
 * - `semantic` → **L2 语义**（LLM 判定，**建议非结论**）。
 */
export type ConflictType = "life-status" | "timeline" | "numeric" | "semantic";

/** L1 属性维度（与 `ConflictType` 的结构化子集一一对应） */
export type L1Attribute = "life-status" | "timeline" | "numeric";

/** 冲突报告（`conflict_record` 落库载体；`evidence` 为**原文片段**） */
export interface ConflictReport {
  /** 冲突设定卡 A（id 较小者） */
  aId: number;
  /** 冲突设定卡 B（id 较大者） */
  bId: number;
  /** 冲突类型 */
  type: ConflictType;
  /** 判定依据（**原文逐字片段**，L1 零幻觉 / L2 引自候选或约束卡） */
  evidence: string;
  /** 严重度 */
  severity: ConflictSeverity;
}

/** L2 判定结论（**建议非结论**） */
export interface JudgeVerdict {
  verdict: "contradiction" | "consistent" | "uncertain";
  reason: string;
  evidence?: string;
}

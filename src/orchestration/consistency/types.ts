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

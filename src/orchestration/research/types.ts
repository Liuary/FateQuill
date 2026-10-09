/**
 * 研究/采样契约（stage-07 T1）
 *
 * 职责：定义多模型无限制创作（**采样模式**）的模型描述（`SamplingModel`）与
 * **素材候选**（`MaterialCandidate`，会话内存）。
 *
 * `MaterialSourceType` 引自 `@/domain/models/material`（**单一来源**，REV-016②）；
 * 候选**自带采集通道 `sourceType`**，供 T3 确认入库时透传（REV-011）。
 */

import type { MaterialSourceType } from "@/domain/models/material";
import type { ModelProvider } from "@/orchestration/types";

/** 素材候选（会话内存；**自带采集通道**，标记后入库时透传） */
export interface MaterialCandidate {
  id: string;
  sourceType: MaterialSourceType;
  /** 产出该候选的模型（`model_config.label`） */
  sourceModel: string;
  content: string;
  createdAt: number;
}

/** 参与采样的模型（经 `model_config` + provider 适配器构造） */
export interface SamplingModel {
  configId: number;
  providerId: string;
  label: string;
  model: string;
  provider: ModelProvider;
}

/** 交叉判断置信度：**≥2 模型共识 = `high`**；单模型 = `pending`（待人工确认） */
export type Confidence = "high" | "pending";

/** 单个模型的 AI 味摘取结果 */
export interface ModelExcerpts {
  /** 来源标识（送入 `extractFlavorExcerpts` 的 `model`） */
  model: string;
  excerpts: { excerpt: string; reason: string }[];
}

/**
 * 交叉判断结果（**自带采集通道**，供 T3 确认入库时透传，REV-011）。
 * `excerpt` 为 verbatim 原文引文（**精确定位键**）；`positionHint` 为定位提示。
 */
export interface CrossJudgeResult {
  excerpt: string;
  positionHint?: string;
  /** 命中的模型集合（**共识度**依据） */
  models: string[];
  reason: string;
  confidence: Confidence;
  sourceType: "multi_model_cross";
}

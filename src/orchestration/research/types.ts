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

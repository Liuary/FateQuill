/**
 * 审查评估契约（stage-06 T1）
 *
 * 职责：定义四维审查维度、评估结果（`EvaluationResult`）与评审输入（`ReviewInput`），
 * 以及评估器（`Evaluator`）接口。**provider 无关**——不含网络/模型具体语义，
 * `model` / `temperature` 由调用方从默认 `model_config` 提供（复用引擎契约，见 docs/structure.md §8）。
 */

/** 四维审查维度 */
export type ReviewDimension = "plot" | "worldview" | "compliance" | "humanity";

/** 四维维度常量表（顺序固定：情节 / 世界观 / 合规 / 人文） */
export const REVIEW_DIMENSIONS: ReviewDimension[] = ["plot", "worldview", "compliance", "humanity"];

/** 评估结果契约 */
export interface EvaluationResult {
  /** 评分（夹取至 0–100） */
  score: number;
  /** 判定理由（归一为字符串数组） */
  reasons: string[];
  /** 结构化发现（维度自定义，可选） */
  findings?: unknown;
}

/** 评审输入（provider 无关；model/temperature 由调用方从默认 model_config 提供） */
export interface ReviewInput {
  /** 审查维度 */
  dimension: ReviewDimension;
  /** 待审正文 */
  content: string;
  /** 上下文（作品 / 章节 / 设定卡，可选） */
  context?: {
    novelId?: number;
    chapterId?: number;
    chapterTitle?: string;
    settingCards?: { title: string; content: string }[];
  };
  /** 评审使用的模型名 */
  model: string;
  /** 采样温度（评审建议 0） */
  temperature?: number;
}

/** 评估器（每维一个；LLM 维经 ModelProvider，合规维为规则引擎） */
export interface Evaluator {
  /** 维度标识（即评估器 id） */
  readonly id: ReviewDimension;
  /** 执行评估；失败应抛错，由 `evaluateWithFallback` 兜底降级 */
  evaluate(input: ReviewInput): Promise<EvaluationResult>;
}

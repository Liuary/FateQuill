/**
 * 闭环回注度量实验（stage-07 T6）
 *
 * 目的：度量**规避 skill 回注**（`buildChapterPrompt` 的 `skills`）对生成物的效果——
 * 同一模型、**温度 0**，对固定样本集各跑「skill 关 / skill 开」两轮，再用 **stage-06 四维评审管线**
 * 打分，输出四维对比表。
 *
 * **学术诚实**：小样本雏形度量（样本集 ≥3 篇），**非统计显著性**；主指标 = 真人感↑，
 * 约束 = 其余三维（剧情/世界观/合规）**不回退超容差**。
 * **真机执行**需真实模型调用（消耗额度），由用户 / feel-tester 协验执行（见 `report.md` 数据状态）。
 */

import type { ModelProvider } from "@/orchestration/types";
import {
  buildChapterPrompt,
  DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT,
  type PromptSkill,
} from "@/orchestration/prompts/chapter-generation";
import { createEvaluatorRegistry, evaluateWithFallback } from "@/orchestration/review/evaluator";
import { registerBuiltinEvaluators } from "@/orchestration/review/register";
import { REVIEW_DIMENSIONS, type ReviewDimension } from "@/orchestration/review/types";

/** 四维分数（stage-06 评审口径） */
export interface DimensionScores {
  plot: number;
  worldview: number;
  compliance: number;
  humanity: number;
}

/** 固定样本（入库可复现） */
export interface ExperimentSample {
  id: string;
  title: string;
  content: string;
}

export interface SampleResult {
  sampleId: string;
  title: string;
  baseline: DimensionScores;
  withSkills: DimensionScores;
}

export interface ExperimentReport {
  samples: SampleResult[];
  /** 主指标：真人感均值增量（skill 开 − 关） */
  humanityDelta: number;
  /** 约束回退明细（非真人感维度回退超容差） */
  regressions: { sampleId: string; dimension: ReviewDimension; delta: number }[];
  tolerance: number;
  /** 主指标是否达成（真人感均值提升） */
  primaryMet: boolean;
  /** 约束是否满足（无回退超容差） */
  constraintMet: boolean;
}

/** 回退容差（分） */
export const EXPERIMENT_TOLERANCE = 5;

/** 实验用 skill 规则（缺省；可由调用方覆盖） */
export const EXPERIMENT_SKILLS: PromptSkill[] = [
  { title: "去套话", rule: "避免「不禁」「仿佛」「五味杂陈」等套话与情绪直陈" },
  { title: "句式变化", rule: "避免连续相同句式与排比堆叠，长短句交错" },
  { title: "信息密度", rule: "删去空洞形容，每句承载可感知的动作或细节" },
];

/** 约束维度（主指标之外的其余三维） */
const CONSTRAINT_DIMENSIONS: ReviewDimension[] = ["plot", "worldview", "compliance"];

/** 均值（空数组 → 0） */
export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 四维对比表（Markdown；每样本 × 每维一行） */
export function formatReportTable(report: ExperimentReport): string {
  const header = "| 样本 | 维度 | skill 关 | skill 开 | Δ |";
  const separator = "| --- | --- | --- | --- | --- |";
  const rows: string[] = [];
  for (const sample of report.samples) {
    for (const dimension of REVIEW_DIMENSIONS) {
      const before = sample.baseline[dimension];
      const after = sample.withSkills[dimension];
      const delta = after - before;
      rows.push(
        `| ${sample.sampleId} | ${dimension} | ${before} | ${after} | ${delta >= 0 ? "+" : ""}${delta} |`,
      );
    }
  }
  return [header, separator, ...rows].join("\n");
}

/** 实验依赖（可注入；测试用假实现） */
export interface ExperimentDeps {
  /** 以给定 skill 生成产物（`skills` 为 `[]` 即「skill 关」基线） */
  generate: (content: string, skills: PromptSkill[]) => Promise<string>;
  /** 用 stage-06 四维评审管线评分 */
  evaluate: (content: string) => Promise<DimensionScores>;
}

/** 运行「skill 关 / 开」对比实验 */
export async function runExperiment(
  samples: ExperimentSample[],
  deps: ExperimentDeps,
  options?: { tolerance?: number; skills?: PromptSkill[] },
): Promise<ExperimentReport> {
  const tolerance = options?.tolerance ?? EXPERIMENT_TOLERANCE;
  const skills = options?.skills ?? EXPERIMENT_SKILLS;

  const results: SampleResult[] = [];
  for (const sample of samples) {
    const baselineText = await deps.generate(sample.content, []); // skill 关
    const withSkillsText = await deps.generate(sample.content, skills); // skill 开
    results.push({
      sampleId: sample.id,
      title: sample.title,
      baseline: await deps.evaluate(baselineText),
      withSkills: await deps.evaluate(withSkillsText),
    });
  }

  const humanityDelta =
    mean(results.map((result) => result.withSkills.humanity)) -
    mean(results.map((result) => result.baseline.humanity));

  const regressions: ExperimentReport["regressions"] = [];
  for (const result of results) {
    for (const dimension of CONSTRAINT_DIMENSIONS) {
      const delta = result.withSkills[dimension] - result.baseline[dimension];
      if (delta < -tolerance) {
        regressions.push({ sampleId: result.sampleId, dimension, delta });
      }
    }
  }

  return {
    samples: results,
    humanityDelta,
    regressions,
    tolerance,
    primaryMet: humanityDelta > 0,
    constraintMet: regressions.length === 0,
  };
}

/**
 * 真机默认依赖：生成经 `buildChapterPrompt`（**注入 skills**）→ provider 聚合；
 * 评审经 stage-06 四维评估器（**温度 0**）。
 */
export function createDefaultExperimentDeps(opts: {
  provider: ModelProvider;
  model: string;
  instruction?: string;
}): ExperimentDeps {
  const registry = registerBuiltinEvaluators(createEvaluatorRegistry(), opts.provider);
  return {
    async generate(content, skills) {
      const options = buildChapterPrompt({
        systemPrompt: DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT,
        settingCards: [],
        previousChapterTail: content,
        userInstruction: opts.instruction ?? "续写下一段，保持既有语气。",
        skills,
        model: opts.model,
        temperature: 0, // 同模型 / 温度 0
      });
      let full = "";
      for await (const chunk of opts.provider.stream(options)) {
        full += chunk.delta;
      }
      return full.trim();
    },
    async evaluate(content) {
      const scores: DimensionScores = { plot: 0, worldview: 0, compliance: 0, humanity: 0 };
      for (const dimension of REVIEW_DIMENSIONS) {
        const result = await evaluateWithFallback(registry.resolve(dimension), {
          dimension,
          content,
          model: opts.model,
          temperature: 0,
        });
        scores[dimension] = result.score;
      }
      return scores;
    },
  };
}

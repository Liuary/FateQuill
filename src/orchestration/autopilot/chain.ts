/**
 * 全自动创作**链路编排**（stage-12 T2）
 *
 * 每章：**推演（多温度）→ 择优 → 生成 → 审查 → 重写（≤ N）→ 判定（过阈 / 降级）→ 自动归档**。
 *
 * **复用既有契约（不重写）**：装配 `buildChapterPrompt`（stage-05）、推演 `runExploration`（stage-08）、
 * 审查 `evaluateWithFallback` + `rewriteChapter`（stage-06）、归档 `deps.archiveFn`（真机接 stage-11）。
 *
 * **零人工交互**：链路不 await 任何用户输入（不弹确认、不等待点击）；单章失败**降级不抛穿**、**不阻塞续跑**。
 * 熔断（预算/连续失败/章数）与断点落库见 **op-004**；一致性冲突策略见 **op-005**。
 */

import { TURN_CARD_SYSTEM_PROMPT } from "@/orchestration/exploration/parse";
import { runExploration, type RunBranchInput } from "@/orchestration/exploration/runner";
import { DEFAULT_TEMPERATURES } from "@/orchestration/exploration/temperature";
import {
  DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT,
  buildChapterPrompt,
} from "@/orchestration/prompts/chapter-generation";
import {
  DEFAULT_WEIGHTS,
  weightedTotal,
  type EvaluationBundle,
} from "@/orchestration/review/aggregate";
import { evaluateWithFallback } from "@/orchestration/review/evaluator";
import { rewriteChapter, type FailedDimensionFeedback } from "@/orchestration/review/rewrite";
import { REVIEW_DIMENSIONS } from "@/orchestration/review/types";
import type { ChatOptions, Chunk, ModelProvider } from "@/orchestration/types";
import { isPassed, markDegraded, pickBranch, shouldRewrite, type BranchScore } from "./decide";
import type {
  AutopilotChapterInput,
  AutopilotConfig,
  AutopilotDeps,
  AutopilotProgress,
  AutopilotPromptContext,
  ChapterOutcome,
  RunOutcome,
} from "./types";

/** 生成期温度（单次生成，收敛优先） */
const GENERATION_TEMPERATURE = 0.7;

/** 把注入的取流包装为 stage-06 重写所需的 `ModelProvider`（**复用契约**，不新增 provider） */
function providerOf(deps: AutopilotDeps): ModelProvider {
  return { id: "autopilot-injected", stream: deps.streamFor };
}

/** 非流式收口（中止 → 抛 `aborted`，由调用方降级） */
async function collect(iterable: AsyncIterable<Chunk>, signal?: AbortSignal): Promise<string> {
  let full = "";
  for await (const chunk of iterable) {
    if (signal?.aborted) {
      throw new Error("aborted");
    }
    full += chunk.delta;
  }
  return full.trim();
}

/** 生成期上下文（缺省空） */
async function contextOf(
  chapter: AutopilotChapterInput,
  deps: AutopilotDeps,
): Promise<AutopilotPromptContext> {
  if (!deps.contextFor) {
    return { settingCards: [], previousChapterTail: "" };
  }
  return deps.contextFor(chapter);
}

/** 审查（缺省：stage-06 `evaluateWithFallback` 逐维；可经 `deps.reviewFn` 覆盖） */
async function reviewContent(content: string, deps: AutopilotDeps): Promise<EvaluationBundle> {
  if (deps.reviewFn) {
    return deps.reviewFn(content);
  }
  const results: EvaluationBundle = {};
  for (const dimension of REVIEW_DIMENSIONS) {
    // 未注册维度不参与（缺维由 `weightedTotal` 容错）
    if (!deps.evaluators.has(dimension)) {
      continue;
    }
    results[dimension] = await evaluateWithFallback(deps.evaluators.resolve(dimension), {
      dimension,
      content,
      model: deps.model,
      temperature: 0,
    });
  }
  return results;
}

/** 未过阈维度 → 重写反馈（复用 stage-06 反馈注入） */
function feedbackOf(results: EvaluationBundle, passThreshold: number): FailedDimensionFeedback[] {
  const feedback: FailedDimensionFeedback[] = [];
  for (const dimension of REVIEW_DIMENSIONS) {
    const result = results[dimension];
    if (result && result.score < passThreshold) {
      feedback.push({ dimension, score: result.score, reasons: result.reasons });
    }
  }
  return feedback;
}

/** 推演：多温度并行 → **逐分支审查择优**（取加权总分最高；全无卡片 → 回退无推演生成） */
async function exploreAndPick(
  chapter: AutopilotChapterInput,
  config: AutopilotConfig,
  deps: AutopilotDeps,
  context: AutopilotPromptContext,
  signal?: AbortSignal,
): Promise<{ branchId: string; cardText: string } | null> {
  const branches: RunBranchInput[] = DEFAULT_TEMPERATURES.map((temperature, index) => ({
    id: `t${index}`,
    temperature,
    effectiveTemperature: temperature,
    clamped: false,
  }));

  const explored = await runExploration({
    branches,
    streamFor: (branch) =>
      deps.streamFor(
        buildChapterPrompt({
          systemPrompt: TURN_CARD_SYSTEM_PROMPT,
          settingCards: context.settingCards,
          previousChapterTail: context.previousChapterTail,
          userInstruction: chapter.instruction,
          model: deps.model,
          temperature: branch.effectiveTemperature,
        }),
      ),
    signal,
  });

  const scored: { branch: BranchScore; cardText: string }[] = [];
  for (const branch of explored) {
    if (!branch.card) {
      continue;
    }
    const cardText = [branch.card.summary, ...branch.card.keyTurns].join("\n");
    const total = weightedTotal(await reviewContent(cardText, deps), weightsOf(config));
    scored.push({ branch: { id: branch.id, total }, cardText });
  }

  const best = pickBranch(scored.map((entry) => entry.branch));
  if (!best) {
    return null;
  }
  const chosen = scored.find((entry) => entry.branch.id === best.id);
  return chosen ? { branchId: chosen.branch.id, cardText: chosen.cardText } : null;
}

/** 审查权重（缺省四维平衡） */
function weightsOf(config: AutopilotConfig) {
  return config.reviewWeights ?? DEFAULT_WEIGHTS;
}

/** 生成一章正文（stage-05 装配 + 单次生成） */
async function generate(
  chapter: AutopilotChapterInput,
  deps: AutopilotDeps,
  context: AutopilotPromptContext,
  branchText: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const instruction = branchText
    ? `${chapter.instruction}\n\n【推演择优走向】\n${branchText}`
    : chapter.instruction;
  const options: ChatOptions = buildChapterPrompt({
    systemPrompt: DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT,
    settingCards: context.settingCards,
    previousChapterTail: context.previousChapterTail,
    userInstruction: instruction,
    model: deps.model,
    temperature: GENERATION_TEMPERATURE,
  });
  return collect(deps.streamFor(options), signal);
}

/** 单章链路：推演择优 → 生成 → 审查 → 重写（≤N）→ 判定 → 归档 */
export async function runChapter(
  chapter: AutopilotChapterInput,
  config: AutopilotConfig,
  deps: AutopilotDeps,
  signal?: AbortSignal,
): Promise<ChapterOutcome> {
  const context = await contextOf(chapter, deps);
  const picked = await exploreAndPick(chapter, config, deps, context, signal);

  let content = await generate(chapter, deps, context, picked?.cardText ?? null, signal);
  let results = await reviewContent(content, deps);
  let total = weightedTotal(results, weightsOf(config));
  let round = 0;

  while (shouldRewrite(total, config.passThreshold, round, config.maxRewriteRounds)) {
    round += 1;
    content = await rewriteChapter({
      provider: providerOf(deps),
      model: deps.model,
      rewrite: { content, feedback: feedbackOf(results, config.passThreshold) },
    });
    results = await reviewContent(content, deps);
    total = weightedTotal(results, weightsOf(config));
  }

  // 自动归档（每章完成后；真机接 stage-11 抽取，候选按配置自动确认或入待确认队列）
  await deps.archiveFn(chapter, content);

  const outcome: ChapterOutcome = {
    index: chapter.index,
    title: chapter.title,
    content,
    score: total,
    degraded: total < config.passThreshold,
    rounds: round,
  };
  if (outcome.degraded) {
    // 仍不达标 → 标记降级 + 原因（**不阻塞续跑**）
    Object.assign(
      outcome,
      markDegraded(`重写 ${round} 轮后加权总分 ${total} < 阈值 ${config.passThreshold}`),
    );
  }
  if (picked) {
    outcome.branchId = picked.branchId;
  }
  return outcome;
}

/** 整轮编排：逐章串行（**零人工交互**），逐章回调进度；单章失败降级不阻塞 */
export async function runAutopilot(opts: {
  outline: AutopilotChapterInput[];
  config: AutopilotConfig;
  deps: AutopilotDeps;
  onProgress?: (progress: AutopilotProgress) => void;
  signal?: AbortSignal;
}): Promise<RunOutcome> {
  const { config, deps, onProgress, signal } = opts;
  const chapters = opts.outline.slice(0, Math.max(0, config.maxChapters));
  const outcomes: ChapterOutcome[] = [];

  const emit = (status: AutopilotProgress["status"], currentIndex: number) => {
    onProgress?.({ status, currentIndex, total: chapters.length, chapters: [...outcomes] });
  };

  for (const [position, chapter] of chapters.entries()) {
    if (signal?.aborted) {
      emit("aborted", position);
      return summarize(outcomes, config, true);
    }
    emit("running", position);
    try {
      outcomes.push(await runChapter(chapter, config, deps, signal));
    } catch (error) {
      // 单章异常（含 abort）：降级收录 + 记录原因，**不阻塞续跑**
      const reason = error instanceof Error ? error.message : String(error);
      outcomes.push({
        index: chapter.index,
        title: chapter.title,
        content: "",
        rounds: 0,
        ...markDegraded(`章生成失败：${reason}`),
      });
      if (signal?.aborted) {
        emit("aborted", position);
        return summarize(outcomes, config, true);
      }
    }
    emit("running", position + 1);
  }

  emit("done", chapters.length);
  return summarize(outcomes, config, false);
}

/** 汇总（过阈 / 降级计数） */
function summarize(
  outcomes: ChapterOutcome[],
  config: AutopilotConfig,
  aborted: boolean,
): RunOutcome {
  return {
    chapters: outcomes,
    passed: outcomes.filter((chapter) => isPassed(chapter, config.passThreshold)).length,
    degraded: outcomes.filter((chapter) => chapter.degraded).length,
    aborted,
  };
}

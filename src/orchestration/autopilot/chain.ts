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
import { checkBreakers, estimateTokens } from "./breaker";
import { conflictKey, decideConflictPolicy } from "./conflict-policy";
import type {
  AutopilotChapterInput,
  AutopilotConfig,
  AutopilotDeps,
  AutopilotProgress,
  AutopilotPromptContext,
  ChapterOutcome,
  RunOutcome,
  SettledChapter,
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

/**
 * 一致性冲突策略（stage-12 T4）：章归档后检测（stage-11 `runL1Rules`）→ `decideConflictPolicy` 决策：
 * - **暂停路径（默认）**：冲突经 `save_conflict_record` 落 `open`（**留痕**）→ **暂停 + 通知**（保留用户终裁决）；
 * - **授权路径（用户显式勾选）**：落 `ignored` + `action:"ignore"`（**留痕**）→ **继续**。
 * 两路径**均留痕**（可审计）；同一冲突（`(aId,bId,type)`）**不重复落库**。
 */
async function handleConflicts(
  deps: AutopilotDeps,
  config: AutopilotConfig,
  seen: Set<string>,
): Promise<{ found: number; paused: boolean }> {
  if (!deps.detectConflicts || !deps.conflictSink) {
    return { found: 0, paused: false };
  }
  const detected = await deps.detectConflicts();
  let found = 0;
  for (const conflict of detected) {
    const key = conflictKey(conflict);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const decision = decideConflictPolicy({ conflict, pauseOnConflict: config.pauseOnConflict });
    // 两路径**均落库留痕**（`save_conflict_record`）
    const id = await deps.conflictSink.saveConflictRecord(decision.record);
    found += 1;
    if (decision.action === "ignore-continue") {
      // 授权路径：`resolve_conflict_record(action:"ignore")` → 记录置 `ignored` 后**继续**
      await deps.conflictSink.resolveConflictRecord(id, "ignore");
    } else {
      // 默认路径：**暂停 + 通知**（不做自动处置，保留用户终裁决）
      return { found, paused: true };
    }
  }
  return { found, paused: false };
}

/** 续跑 seed：已完成章 → 章结果（不重跑，仅为报告与统计） */ function seedOutcome(
  chapter: AutopilotChapterInput,
  settled: SettledChapter,
): ChapterOutcome {
  const outcome: ChapterOutcome = {
    index: chapter.index,
    title: chapter.title,
    content: "",
    degraded: settled.status === "degraded",
    rounds: 0,
  };
  if (typeof settled.score === "number") {
    outcome.score = settled.score;
  }
  if (settled.degradedReason) {
    outcome.degradedReason = settled.degradedReason;
  }
  return outcome;
}

/** 整轮编排：逐章串行（**零人工交互**）+ **熔断三层**（任一触发即停 + 出报告）+ 断点落库（可续跑） */
export async function runAutopilot(opts: {
  outline: AutopilotChapterInput[];
  config: AutopilotConfig;
  deps: AutopilotDeps;
  onProgress?: (progress: AutopilotProgress) => void;
  signal?: AbortSignal;
  /** 续跑：既有 run id（缺省 → 新建并落库） */
  runId?: number;
  /** 续跑：已完成章（**不重跑**；用于 seed 报告与跳过） */
  completed?: SettledChapter[];
  /** 续跑：已花费 token（预算熔断累计） */
  spentTokens?: number;
}): Promise<RunOutcome> {
  const { config, deps, onProgress, signal } = opts;
  const chapters = opts.outline;
  const persistence = deps.persistence;
  const settled = new Map((opts.completed ?? []).map((entry) => [entry.orderIndex, entry]));

  let runId = opts.runId;
  if (persistence && runId === undefined) {
    runId = await persistence.saveRun({
      status: "running",
      configJson: JSON.stringify({ config, outline: chapters }),
    });
  }

  const outcomes: ChapterOutcome[] = [];
  let spentTokens = opts.spentTokens ?? 0;
  let consecutiveFailures = 0;
  let conflictsFound = 0;
  const seenConflicts = new Set<string>();
  let trippedBy: RunOutcome["trippedBy"];
  let trippedDetail: string | undefined;
  let aborted = false;

  const emit = (status: AutopilotProgress["status"], currentIndex: number) => {
    onProgress?.({ status, currentIndex, total: chapters.length, chapters: [...outcomes] });
  };

  for (const [position, chapter] of chapters.entries()) {
    // 续跑：已完成章**直接跳过**（不重跑）
    const seed = settled.get(chapter.index);
    if (seed) {
      outcomes.push(seedOutcome(chapter, seed));
      continue;
    }

    if (signal?.aborted) {
      aborted = true;
      break;
    }

    // 熔断三层：**启动新章前**判定（触发即停 + 出报告）
    const verdict = checkBreakers(
      { spentTokens, consecutiveFailures, producedChapters: outcomes.length },
      config,
    );
    if (verdict.tripped) {
      trippedBy = verdict.reason;
      trippedDetail = verdict.detail;
      break;
    }

    emit("running", position);
    if (persistence && runId !== undefined) {
      // 章起点：落 running（中断后据此识别未完成章）
      await persistence.saveChapter({
        runId,
        orderIndex: chapter.index,
        state: "running",
        attempt: 0,
      });
    }

    let outcome: ChapterOutcome;
    try {
      outcome = await runChapter(chapter, config, deps, signal);
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
      outcome = outcomes[outcomes.length - 1];
      if (signal?.aborted) {
        aborted = true;
        if (persistence && runId !== undefined) {
          await persistence.saveChapter({
            runId,
            orderIndex: chapter.index,
            state: "failed",
            degradedReason: outcome.degradedReason ?? "",
            attempt: 0,
          });
        }
        break;
      }
    }

    if (outcome !== outcomes[outcomes.length - 1]) {
      outcomes.push(outcome);
    }
    spentTokens += estimateTokens(outcome.content);
    consecutiveFailures = outcome.degraded ? consecutiveFailures + 1 : 0;

    if (persistence && runId !== undefined) {
      // 章终点：落 done / degraded（含分数与原因）——续跑依据
      await persistence.saveChapter({
        runId,
        orderIndex: chapter.index,
        state: outcome.degraded ? "degraded" : "done",
        score: outcome.score ?? null,
        degradedReason: outcome.degradedReason ?? "",
        attempt: outcome.rounds,
      });
    }

    // 一致性冲突策略（stage-11 检测 → 决策 → 留痕）：默认**暂停 + 通知**；授权则**忽略并继续**
    const conflictOutcome = await handleConflicts(deps, config, seenConflicts);
    conflictsFound += conflictOutcome.found;
    if (conflictOutcome.paused) {
      trippedBy = "conflict";
      trippedDetail = `检测到 ${conflictOutcome.found} 处一致性冲突 → 已暂停（默认策略，保留用户裁决）；授权「自动忽略」后可从断点续跑`;
      break;
    }

    emit("running", position + 1);
  }

  // 落库终态：中止 → `aborted`；熔断 → **`paused`（可续跑）**；正常 → `completed`
  const finalStatus = aborted ? "aborted" : trippedBy ? "paused" : "completed";
  if (persistence && runId !== undefined) {
    await persistence.saveRun({
      runId,
      status: finalStatus,
      configJson: JSON.stringify({ config, outline: chapters }),
    });
  }

  emit(aborted ? "aborted" : trippedBy ? "paused" : "done", outcomes.length);
  const summary = summarize(outcomes, config, aborted, conflictsFound);
  if (trippedBy) {
    summary.trippedBy = trippedBy;
    if (trippedDetail) {
      summary.trippedDetail = trippedDetail;
    }
  }
  return summary;
}

/** 汇总（过阈 / 降级 / 冲突计数） */
function summarize(
  outcomes: ChapterOutcome[],
  config: AutopilotConfig,
  aborted: boolean,
  conflicts: number,
): RunOutcome {
  return {
    chapters: outcomes,
    passed: outcomes.filter((chapter) => isPassed(chapter, config.passThreshold)).length,
    degraded: outcomes.filter((chapter) => chapter.degraded).length,
    aborted,
    conflicts,
  };
}

/**
 * 全自动创作契约（stage-12 T2）
 *
 * **可注入依赖**（`AutopilotDeps`）使链路支持 **mock（单测/离线）** 与 **真机（provider + stage-06 审查 + stage-11 归档）** 两条路径；
 * 编排**零人工交互**（不 await 任何用户输入）。熔断与断点落库见 op-004、冲突策略见 op-005。
 */

import type { ChapterSettingCard } from "@/orchestration/prompts/chapter-generation";
import type { ConflictReport } from "@/orchestration/consistency/types";
import type { EvaluationBundle, ReviewWeights } from "@/orchestration/review/aggregate";
import type { EvaluatorRegistry } from "@/orchestration/review/evaluator";
import type { ChatOptions, Chunk } from "@/orchestration/types";

/** 全自动配置（`maxRewriteRounds` / `passThreshold` / `consecutiveFailureLimit` 有缺省） */
export interface AutopilotConfig {
  /** 最多产出章数（**上限**；实际以大纲条数为准取较小者） */
  maxChapters: number;
  /** 自动重写轮数上限（**默认 2**，与 stage-06 回路一致） */
  maxRewriteRounds: number;
  /** 通过阈值（加权总分；**默认 60**，与 stage-06 `passThreshold` 一致） */
  passThreshold: number;
  /** 审查权重（缺省 `DEFAULT_WEIGHTS` 四维平衡） */
  reviewWeights?: ReviewWeights;
  /** 归档候选是否**自动确认**入库（false → 入待确认队列，留人工） */
  autoConfirmArchive: boolean;
  /** 遇一致性冲突是否暂停（**op-005 使用**；本 op 仅登记） */
  pauseOnConflict: boolean;
  /** 预算上限（**op-004 熔断**；本 op 仅登记） */
  budgetLimit?: number;
  /** 连续失败上限（**op-004 熔断**；默认 3） */
  consecutiveFailureLimit: number;
}

/** 大纲单章（自动链路的输入） */
export interface AutopilotChapterInput {
  index: number;
  title: string;
  instruction: string;
}

/** 单章结果 */
export interface ChapterOutcome {
  index: number;
  title: string;
  /** 产出正文 */
  content: string;
  /** 审查加权总分（缺省 = 未评分，如终止/失败） */
  score?: number;
  /** 是否降级收录（**不阻塞续跑**） */
  degraded: boolean;
  /** 降级原因（`degraded === true` 时必有） */
  degradedReason?: string;
  /** 实际重写轮数 */
  rounds: number;
  /** 推演择优选中的分支 id（未推演则缺省） */
  branchId?: string;
}

/** 进度态（前端 `autopilotStore` 的写入源） */
export interface AutopilotProgress {
  status: "idle" | "running" | "paused" | "done" | "aborted";
  currentIndex: number;
  total: number;
  chapters: ChapterOutcome[];
}

/** 整轮结果 */
export interface RunOutcome {
  chapters: ChapterOutcome[];
  /** 达阈章数 */
  passed: number;
  /** 降级章数 */
  degraded: number;
  /** 是否被中止（用户 `abort`） */
  aborted: boolean;
  /** 熔断原因（三层任一触发即停时写入；未触发为缺省） */
  trippedBy?: "budget" | "consecutive-failure" | "max-chapters" | "conflict";
  /** 熔断细节（可读） */
  trippedDetail?: string;
  /** 本轮**新检出**的一致性冲突数（含暂停路径与授权忽略路径；可审计留痕见 `conflict_record`） */
  conflicts: number;
}

/** 续跑：已完成章（**不重跑**，用于 seed 报告与跳过） */
export interface SettledChapter {
  orderIndex: number;
  status: "done" | "degraded";
  score?: number | null;
  degradedReason?: string;
}

/**
 * 冲突落库端口（**真机**：IPC `save_conflict_record` + `resolve_conflict_record`，即 stage-11 `conflict_record`）。
 * 编排层只依赖本端口，**经注入**接入（mock/离线不注入 → 不做一致性检测与落库）。
 */
export interface AutopilotConflictSink {
  /** → IPC **`save_conflict_record`**；返回冲突记录 id */
  saveConflictRecord(record: {
    aId: number;
    bId: number;
    type: string;
    evidence: string;
    severity: string;
    status: "open" | "ignored";
    action: string;
  }): Promise<number>;
  /** → IPC **`resolve_conflict_record`**（授权忽略路径：`action: "ignore"` → 记录置 `ignored`） */
  resolveConflictRecord(id: number, action: "ignore"): Promise<void>;
}

/**
 * 断点持久化（**注入**）：真机经 `repositories.autopilot`（迁移 v6）；mock/离线不注入（纯内存链路）。
 */
export interface AutopilotPersistence {
  /** upsert run（`runId` 缺省 → 新建）；返回 run id */
  saveRun(input: {
    runId?: number;
    status: "running" | "paused" | "completed" | "aborted" | "failed";
    configJson: string;
  }): Promise<number>;
  /** upsert 单章断点（键 = `runId + orderIndex`） */
  saveChapter(input: {
    runId: number;
    orderIndex: number;
    state: "pending" | "running" | "done" | "degraded" | "failed";
    score?: number | null;
    degradedReason?: string;
    attempt?: number;
  }): Promise<void>;
}

/** 生成期上下文（真机由 stage-05 装配输入提供；缺省空） */
export interface AutopilotPromptContext {
  settingCards: ChapterSettingCard[];
  previousChapterTail: string;
}

/**
 * 可注入依赖：
 * - `streamFor`：取流（真机 `provider.stream`；mock 假流）；
 * - `evaluators`：审查器注册表（真机 `registerBuiltinEvaluators(createEvaluatorRegistry(), provider)`）；
 * - `archiveFn`：归档（真机 stage-11 抽取 + 落库；mock 记录调用）；
 * - `reviewFn?`：**审查覆盖**（可选；测试注入「假审查」，缺省走 stage-06 `evaluateWithFallback` 真审查）；
 * - `contextFor?`：生成期上下文（可选；缺省 `{settingCards: [], previousChapterTail: ""}`）。
 */
export interface AutopilotDeps {
  /** 使用的模型名（审查 `ReviewInput.model` 与生成 `ChatOptions.model`） */
  model: string;
  streamFor: (options: ChatOptions) => AsyncIterable<Chunk>;
  evaluators: EvaluatorRegistry;
  archiveFn: (chapter: AutopilotChapterInput, content: string) => Promise<void>;
  reviewFn?: (content: string) => Promise<EvaluationBundle>;
  contextFor?: (chapter: AutopilotChapterInput) => Promise<AutopilotPromptContext>;
  /** 断点持久化（**可选**：真机注入 → 可续跑；mock/离线缺省 → 纯内存链路） */
  persistence?: AutopilotPersistence;
  /** 一致性冲突检测（**可选**：真机 → stage-11 `runL1Rules`；缺省不做检测） */
  detectConflicts?: () => Promise<ConflictReport[]>;
  /** 冲突落库端口（**可选**：真机 → stage-11 `conflict_record` 命令；缺省不落库） */
  conflictSink?: AutopilotConflictSink;
}

/** 缺省配置（可部分覆盖） */
export function defaultAutopilotConfig(overrides: Partial<AutopilotConfig> = {}): AutopilotConfig {
  return {
    maxChapters: 3,
    maxRewriteRounds: 2,
    passThreshold: 60,
    autoConfirmArchive: true,
    pauseOnConflict: true,
    consecutiveFailureLimit: 3,
    ...overrides,
  };
}

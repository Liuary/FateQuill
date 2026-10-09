/**
 * L2 语义校验（stage-11 T3）
 *
 * 职责：LLM 判定「新设定候选是否与 `main`/`dark` 约束卡矛盾」，输出 `{verdict,reason,evidence}`。
 * **建议非结论**：结果一律带 `advisory: true`（自动判定不直接改数据，由用户裁决）。
 * 失败 / JSON 非法 → **降级 `uncertain`**（不抛穿）；JSON 容错复用 `@/orchestration/review/json`。
 */

import type { ChatOptions, Chunk, ModelRef } from "@/orchestration/types";
import { extractJson } from "@/orchestration/review/json";
import type { JudgeVerdict } from "./types";

/** 判定输出契约（system 段；JSON 结构 + 约束说明） */
export const JUDGE_SYSTEM_PROMPT = [
  "你是简体中文长篇小说的设定一致性审校助手。请判断「新设定候选」是否与「既有约定（主线 / 暗线）」**相互矛盾**。",
  "要求：",
  "1. 只输出如下 JSON，不要输出解释文字：",
  '{"verdict":"contradiction|consistent|uncertain","reason":"<判定理由>","evidence":"<矛盾所依据的原文片段>"}',
  "2. `contradiction` 仅在**明确互斥**（如生死状态、时间线年份、数量数值直接冲突）时使用；",
  "3. 语义相似、详略不同、可以并存的表述一律判 `consistent`；无法判断判 `uncertain`（**宁可不定，不可误报**）；",
  "4. `reason` 用一句话说明理由；`evidence` 引用导致矛盾的原文片段（无可引用则留空字符串）。",
].join("\n");

/** L2 判定结果（**建议非结论**；`constraintIds` 供报告配对） */
export interface JudgeResult extends JudgeVerdict {
  /** 恒为 `true`：自动判定**仅为建议**，不直接改数据 */
  advisory: true;
  /** 本次参与判定的约束卡 id（`main`/`dark`） */
  constraintIds: number[];
}

/** 判定输入：候选（待入库的设定）+ 约束卡（`main`/`dark`） */
export interface JudgeInput {
  candidate: { id?: number; name: string; content: string };
  constraints: { id: number; title: string; content: string }[];
}

/** 构造判定 `ChatOptions`（system = 输出契约；user = 候选 + 约束卡） */
export function buildJudgeOptions(input: JudgeInput & { modelRef: ModelRef }): ChatOptions {
  const constraints = input.constraints
    .map((card) => `- [${card.id}] ${card.title}：${card.content}`)
    .join("\n");
  const user = [
    `【新设定候选】${input.candidate.name}：${input.candidate.content}`,
    "",
    "【既有约定（主线 / 暗线）】",
    constraints || "（无）",
  ].join("\n");
  return {
    model: input.modelRef.model,
    temperature: 0,
    messages: [
      { role: "system", content: JUDGE_SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
  };
}

/** 解析判定 JSON；非法（语法 / 非对象 / verdict 非法）→ 抛错（由 `runL2` 降级 uncertain） */
export function parseJudge(raw: string): JudgeVerdict {
  const data: unknown = JSON.parse(extractJson(raw));
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("invalid judge payload");
  }
  const source = data as { verdict?: unknown; reason?: unknown; evidence?: unknown };
  const verdict = source.verdict;
  if (verdict !== "contradiction" && verdict !== "consistent" && verdict !== "uncertain") {
    throw new Error("invalid judge verdict");
  }
  const result: JudgeVerdict = {
    verdict,
    reason: typeof source.reason === "string" ? source.reason.trim() : "",
  };
  if (typeof source.evidence === "string" && source.evidence.trim()) {
    result.evidence = source.evidence.trim();
  }
  return result;
}

/** 运行 L2 判定（非流式收口；失败 / 非法 JSON → `uncertain` 降级，**不抛穿**） */
export async function runL2(
  input: JudgeInput & {
    modelRef: ModelRef;
    streamFor: (options: ChatOptions) => AsyncIterable<Chunk>;
    signal?: AbortSignal;
  },
): Promise<JudgeResult> {
  const constraintIds = input.constraints.map((card) => card.id);
  try {
    let full = "";
    const options = buildJudgeOptions(input);
    for await (const chunk of input.streamFor(options)) {
      if (input.signal?.aborted) {
        throw new Error("aborted");
      }
      full += chunk.delta;
    }
    const verdict = parseJudge(full);
    return { ...verdict, advisory: true, constraintIds };
  } catch (error) {
    // 失败降级：不确定（不误报、不抛穿）
    return {
      verdict: "uncertain",
      reason: error instanceof Error ? error.message : String(error),
      advisory: true,
      constraintIds,
    };
  }
}

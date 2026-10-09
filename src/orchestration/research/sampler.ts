/**
 * 多模型无限制创作调度器（采样模式，stage-07 T1）
 *
 * **串行逐模型**调用 provider 聚合全文 → 素材候选。
 *
 * 采样「无限制」边界（plan v2 REV-002）：
 * - **不做预算裁剪**（不引用生成侧装配预算/装配器）；
 * - **不触发自动审查**、**不自动保存**；
 * - 产出**仅经 `onCandidate` 进入素材候选**，**绝不进编辑器正文 / 不落 `chapter`**。
 *
 * 停止采样（REV-010①）：`signal` 在**每模型开始前**与**流循环内**检查；已采集候选**保留**。
 */

import type { ChatMessage } from "@/orchestration/types";
import type { MaterialCandidate, SamplingModel } from "./types";

/** 采样 prompt（**无预算裁剪**，自由创作） */
export function buildSamplingMessages(instruction: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "你是简体中文长篇小说创作助手，正在做**自由创作采样**。" +
        "请按用户要求自由发挥，输出中文正文片段；不要解释、不要标题、不要代码块。",
    },
    { role: "user", content: instruction },
  ];
}

// 候选 id 计数器：**模块级可变状态**（跨测试实例共享，v0.2 明确注明）。
// 仅需会话内唯一；如需测试强隔离，可改为工厂注入计数器。
let candidateSeq = 0;

/** 会话内唯一的候选 id */
function nextCandidateId(): string {
  candidateSeq += 1;
  return `mc-${Date.now().toString(36)}-${candidateSeq}`;
}

/**
 * 串行逐模型采样。
 * 逐模型 `provider.stream` 聚合全文后回调 `onCandidate`；`signal.aborted` 时提前退出（已采集候选保留）。
 */
export async function runSampling(
  models: SamplingModel[],
  instruction: string,
  onCandidate: (candidate: MaterialCandidate) => void,
  signal?: AbortSignal,
): Promise<void> {
  const messages = buildSamplingMessages(instruction);
  for (const model of models) {
    if (signal?.aborted) {
      return; // 停止采样：在下一模型开始前退出
    }
    let full = "";
    // 非流式收口：聚合全文（采样不做增量 UI）；signal 透传以便底层中断
    for await (const chunk of model.provider.stream({
      model: model.model,
      messages,
      signal,
    })) {
      if (signal?.aborted) {
        break; // 停止采样：流循环内提前退出
      }
      full += chunk.delta;
    }
    const content = full.trim();
    if (!content) {
      continue; // 空产出（含被中止）不入候选
    }
    onCandidate({
      id: nextCandidateId(),
      sourceType: "multi_model_creation",
      sourceModel: model.label,
      content,
      createdAt: Date.now(),
    });
  }
}

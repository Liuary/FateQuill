/**
 * 审查编排（stage-06 T5）
 *
 * 职责：串起「运行评审回路 → 入池 / 改判 / 触发重写 / 采纳」。
 * - `runReview`：`runReviewLoop`（自动重写按 store 开关）→ 版本入池（**不替换正文**）；
 * - `rejudge`：用户改判某版本某维度分数 → 重算加权总分（排序随之更新）；
 * - `triggerRewrite`：用户**显式**触发一次重写回路（无视 `autoRewrite` 开关；合规仍仅人工裁决）；
 * - `adopt`：以选定版本经 `EditorController.replaceContent` 替换正文（单条撤销）。
 */

import type { Editor } from "@tiptap/react";
import type { ModelProvider } from "@/orchestration/types";
import type { EvaluatorRegistry } from "@/orchestration/review/evaluator";
import { runReviewLoop } from "@/orchestration/review/loop";
import { weightedTotal } from "@/orchestration/review/aggregate";
import type { ReviewDimension, ReviewInput } from "@/orchestration/review/types";
import { createEditorController } from "@/features/editor/EditorController";
import { useReviewStore } from "@/store/reviewStore";

/** 通过阈值（与 `runReviewLoop` 默认一致） */
export const PASS_THRESHOLD = 60;

/** 维度 → i18n key 后缀（`review` 命名空间） */
export const DIMENSION_LABEL_KEYS: Record<ReviewDimension, string> = {
  plot: "dimPlot",
  worldview: "dimWorldview",
  compliance: "dimCompliance",
  humanity: "dimHumanity",
};

export interface ReviewDeps {
  evaluators: EvaluatorRegistry | null;
  provider: ModelProvider | null;
  model: string;
  /** 待审正文（取编辑器当前 HTML） */
  content: string;
  context?: ReviewInput["context"];
}

/** 审查编排：运行四维评审回路 → 入池；改判；触发重写；采纳（replaceContent） */
export function useReview(editor: Editor | null, deps: ReviewDeps) {
  const runReview = async () => {
    if (!deps.evaluators || !deps.provider) {
      return; // 未就绪（无 model_config / Key）：不运行
    }
    const store = useReviewStore.getState();
    const { needsHuman } = await runReviewLoop({
      provider: deps.provider,
      model: deps.model,
      content: deps.content,
      context: deps.context,
      evaluators: deps.evaluators,
      weights: store.weights,
      passThreshold: PASS_THRESHOLD,
      autoRewrite: store.autoRewrite,
      maxRounds: store.maxRounds,
      onVersion: (v) => useReviewStore.getState().addVersion(v), // 入池，不替换正文
    });
    useReviewStore.getState().setNeedsHumanReview(needsHuman);
  };

  /** 用户改判：覆盖某版本某维度分数 → 重算总分 */
  const rejudge = (versionId: string, dimension: ReviewDimension, score: number) => {
    useReviewStore.setState((state) => ({
      versions: state.versions.map((version) => {
        if (version.id !== versionId) {
          return version;
        }
        const previous = version.results[dimension] ?? { score: 0, reasons: [] };
        const results = { ...version.results, [dimension]: { ...previous, score } };
        return { ...version, results, totalScore: weightedTotal(results, state.weights) };
      }),
    }));
  };

  /** 用户显式触发一次重写回路（无视自动重写开关；合规维度仍不触发重写） */
  const triggerRewrite = async () => {
    if (!deps.evaluators || !deps.provider) {
      return;
    }
    const store = useReviewStore.getState();
    const source =
      store.versions.find((v) => v.id === store.activeVersionId) ??
      store.versions[store.versions.length - 1];
    if (!source) {
      return; // 池中无版本：无从重写
    }
    const { needsHuman } = await runReviewLoop({
      provider: deps.provider,
      model: deps.model,
      content: source.content,
      context: deps.context,
      evaluators: deps.evaluators,
      weights: store.weights,
      passThreshold: PASS_THRESHOLD,
      autoRewrite: true, // 显式触发：无视开关
      maxRounds: 1,
      // 初版已在池中：仅入池本轮重写产物
      onVersion: (v) => {
        if (v.round > 0) {
          useReviewStore.getState().addVersion(v);
        }
      },
    });
    useReviewStore.getState().setNeedsHumanReview(needsHuman);
  };

  /** 采纳：以选定版本替换正文（单条撤销），并置为当前版本 */
  const adopt = async (versionId: string) => {
    const version = useReviewStore.getState().versions.find((v) => v.id === versionId);
    if (!editor || !version) {
      return;
    }
    const controller = createEditorController(editor);
    try {
      controller.replaceContent(version.content); // 整章替换（单条撤销历史）
    } finally {
      // REV-008：一次性 controller 用后 dispose，避免 composition 监听器累积
      controller.dispose();
    }
    useReviewStore.getState().setActive(versionId);
  };

  return { runReview, rejudge, triggerRewrite, adopt };
}

/**
 * 审查面板（stage-06 T5）
 *
 * 职责：第三栏「审查」tab —— 展示四维分数/理由、支持**改判**、**触发重写**、自动重写开关、
 * 版本对比与采纳（`replaceContent`）；**合规低分仅提示人工裁决，不自动重写**。
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEvaluatorRegistry } from "@/orchestration/review/evaluator";
import { registerBuiltinEvaluators } from "@/orchestration/review/register";
import { REVIEW_DIMENSIONS } from "@/orchestration/review/types";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";
import { useGenerationAvailability } from "@/features/generation/useGenerationAvailability";
import { useReviewStore } from "@/store/reviewStore";
import { VersionList } from "./VersionList";
import { DIMENSION_LABEL_KEYS, PASS_THRESHOLD, useReview } from "./useReview";

export interface ReviewPanelProps {
  novelId: number | null;
  chapterId: number | null;
  editor: Editor | null;
}

/** 审查面板：四维面板 + 版本对比采纳 */
export function ReviewPanel({ novelId, chapterId, editor }: ReviewPanelProps) {
  const { t } = useTranslation("review");
  const { state, config } = useGenerationAvailability();
  const versions = useReviewStore((s) => s.versions);
  const activeVersionId = useReviewStore((s) => s.activeVersionId);
  const autoRewrite = useReviewStore((s) => s.autoRewrite);
  const needsHumanReview = useReviewStore((s) => s.needsHumanReview);
  const setAutoRewrite = useReviewStore((s) => s.setAutoRewrite);

  const provider = useMemo(() => (config ? resolveProviderForConfig(config) : null), [config]);
  const evaluators = useMemo(
    () => (provider ? registerBuiltinEvaluators(createEvaluatorRegistry(), provider) : null),
    [provider],
  );

  const { runReview, rejudge, triggerRewrite, adopt } = useReview(editor, {
    evaluators,
    provider,
    model: config?.modelName ?? "",
    content: editor?.getHTML() ?? "",
    context: { novelId: novelId ?? undefined, chapterId: chapterId ?? undefined },
  });

  // 当前展示版本：选中版本，否则池中最新
  const current =
    versions.find((v) => v.id === activeVersionId) ?? versions[versions.length - 1] ?? null;
  const complianceScore = current?.results.compliance?.score;
  const complianceLow = complianceScore !== undefined && complianceScore < PASS_THRESHOLD;

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>

      {(state === "no-config" || state === "no-key") && (
        <p className="text-destructive">{t("guideSettings")}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={state !== "ready" || editor == null || !evaluators}
          onClick={() => void runReview()}
        >
          {t("run")}
        </Button>
        <Button
          variant="outline"
          disabled={!current || !evaluators}
          onClick={() => void triggerRewrite()}
        >
          {t("rewrite")}
        </Button>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={autoRewrite}
            onChange={(event) => setAutoRewrite(event.target.checked)}
          />
          {t("autoRewrite")}
        </label>
      </div>

      {needsHumanReview && <p className="text-destructive text-xs">{t("needsHuman")}</p>}
      {complianceLow && <p className="text-destructive text-xs">{t("complianceManual")}</p>}

      {current ? (
        <section className="flex flex-col gap-2">
          {REVIEW_DIMENSIONS.map((dimension) => {
            const result = current.results[dimension];
            return (
              <div key={dimension} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span>{t(DIMENSION_LABEL_KEYS[dimension])}</span>
                  <span>
                    {t("score")}: {result ? result.score : "-"}
                  </span>
                </div>
                {result && result.reasons.length > 0 && (
                  <ul className="text-muted-foreground list-disc pl-4 text-xs">
                    {result.reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                )}
                <label className="flex items-center gap-2 text-xs opacity-80">
                  {t("rejudge")}
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    value={result ? result.score : ""}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value)) {
                        rejudge(current.id, dimension, value);
                      }
                    }}
                  />
                </label>
              </div>
            );
          })}
        </section>
      ) : (
        <p className="opacity-70">{t("noVersions")}</p>
      )}

      <VersionList
        versions={versions}
        activeVersionId={activeVersionId}
        onSelect={(id) => useReviewStore.getState().setActive(id)}
        onAdopt={(id) => void adopt(id)}
      />
    </div>
  );
}

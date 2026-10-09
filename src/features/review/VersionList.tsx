/**
 * 版本对比列表（stage-06 T5）
 *
 * 职责：按**加权总分降序**展示版本池（label / 总分 / 四维小计）；点击条目回看（选中预览），
 * 「采纳」以该版本替换正文；非最优版本同样保留可回看。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { REVIEW_DIMENSIONS } from "@/orchestration/review/types";
import type { ReviewVersion } from "@/store/reviewStore";
import { DIMENSION_LABEL_KEYS } from "./useReview";

export interface VersionListProps {
  versions: ReviewVersion[];
  activeVersionId: string | null;
  /** 选中回看（预览） */
  onSelect: (id: string) => void;
  /** 采纳该版本（替换正文） */
  onAdopt: (id: string) => void;
}

/** 版本列表 + 加权总分排序 + 采纳 */
export function VersionList({ versions, activeVersionId, onSelect, onAdopt }: VersionListProps) {
  const { t } = useTranslation("review");
  const ranked = [...versions].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-medium">{t("versions")}</h3>
      {ranked.length === 0 ? (
        <p className="text-xs opacity-70">{t("noVersions")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {ranked.map((version) => (
            <li
              key={version.id}
              data-testid="version-item"
              className={
                version.id === activeVersionId
                  ? "border-border flex flex-col gap-1 rounded border p-1"
                  : "border-border/40 flex flex-col gap-1 rounded border p-1"
              }
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect(version.id)}
              >
                {version.label} ｜ {t("totalScore")}: {version.totalScore.toFixed(1)}
                <span className="block text-xs opacity-70">
                  {REVIEW_DIMENSIONS.map(
                    (dimension) =>
                      `${t(DIMENSION_LABEL_KEYS[dimension])} ${version.results[dimension]?.score ?? "-"}`,
                  ).join(" / ")}
                </span>
              </button>
              <Button variant="outline" className="self-start" onClick={() => onAdopt(version.id)}>
                {t("adopt")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

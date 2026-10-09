import { Input } from "@/components/ui/input";
import { REVIEW_DIMENSIONS } from "@/orchestration/review/types";
import type { ReviewDimension } from "@/orchestration/review/types";
import { useReviewStore } from "@/store/reviewStore";

/** 维度中文名（本组件自持，未接入 i18n） */
const DIMENSION_LABELS: Record<ReviewDimension, string> = {
  plot: "剧情",
  worldview: "世界观",
  compliance: "合规",
  humanity: "真人感",
};

/**
 * 四维权重配置（stage-06 T3）
 *
 * 职责：数字输入调整四维权重 → `reviewStore.setWeights`（触发全量总分重算）；
 * 下方按加权总分展示版本排序，权重变化导致的排序变化即时可见。
 */
export function WeightConfig() {
  const weights = useReviewStore((s) => s.weights);
  const setWeights = useReviewStore((s) => s.setWeights);
  const versions = useReviewStore((s) => s.versions);

  const handleChange = (dimension: ReviewDimension, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return; // 非法输入忽略
    }
    setWeights({ ...weights, [dimension]: value });
  };

  const ranked = [...versions].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="flex flex-col gap-2 p-2">
      <h3 className="text-sm font-medium">评审权重</h3>
      {REVIEW_DIMENSIONS.map((dimension) => (
        <label key={dimension} className="flex items-center justify-between gap-2 text-sm">
          <span>{DIMENSION_LABELS[dimension]}</span>
          <Input
            type="number"
            min={0}
            step={0.5}
            className="w-20"
            value={weights[dimension]}
            onChange={(event) => handleChange(dimension, event.target.value)}
          />
        </label>
      ))}
      {ranked.length > 0 ? (
        <ol className="text-muted-foreground flex flex-col gap-1 text-xs">
          {ranked.map((version, index) => (
            <li key={version.id}>
              {index + 1}. {version.label}（{version.totalScore.toFixed(1)}）
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

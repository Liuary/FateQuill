/**
 * 一致性面板（stage-11 T4）
 *
 * 职责：冲突记录列表（**落库、跨会话可查**，含空态）+ 「检测冲突」（L1 规则，离线纯函数）
 * + 逐条处置（改分级 / 编辑设定卡（跳转 + verbatim 定位）/ 标记误报 / 忽略）+「语义复核」（L2，需模型）。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ConflictRecord } from "@/domain/models/conflict-record";
import { useGenerationAvailability } from "@/features/generation/useGenerationAvailability";
import { ConflictCard } from "./ConflictCard";
import { useConflicts } from "./useConflicts";
import { useResolveConflict } from "./useResolveConflict";

export interface ConsistencyPanelProps {
  novelId: number | null;
}

/** 一致性冲突面板 */
export function ConsistencyPanel({ novelId }: ConsistencyPanelProps) {
  const { t } = useTranslation("consistency");
  const { state, config } = useGenerationAvailability();
  const { conflicts, reload, detectL1, reviewL2, detecting, error } = useConflicts(novelId);
  const { resolve, busyAction, error: resolveError } = useResolveConflict({ onResolved: reload });

  return (
    <div data-testid="consistency-panel" className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("conflicts")}</h2>
      <p className="text-xs opacity-70">{t("conflictsGuidance")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          data-testid="detect-conflicts"
          variant="outline"
          disabled={novelId == null || detecting}
          onClick={() => void detectL1()}
        >
          {detecting ? t("detecting") : t("detect")}
        </Button>
      </div>

      {error && <p className="text-destructive text-xs">{t("detectFailed")}</p>}
      {resolveError && <p className="text-destructive text-xs">{t("resolveFailed")}</p>}
      {conflicts.length === 0 && <p className="text-xs opacity-70">{t("conflictEmpty")}</p>}

      {conflicts.map((conflict: ConflictRecord) => (
        <ConflictCard
          key={conflict.id}
          conflict={conflict}
          busyAction={busyAction}
          canReview={config != null && state === "ready"}
          reviewing={detecting}
          onResolve={(target, action, options) => void resolve(target, action, options)}
          onReview={(target) => {
            if (config) {
              void reviewL2(target, config);
            }
          }}
        />
      ))}
    </div>
  );
}

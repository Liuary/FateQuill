/**
 * 冲突卡片（stage-11 T4）
 *
 * 职责：展示一条冲突（`aId/bId`、类型、严重度、状态、原文依据）+ **四条处置动作**：
 * 改分级（含分级选择）/ 编辑设定卡（跳转 + verbatim 定位）/ 标记误报 / 忽略；
 * 另提供 **语义复核（L2）** 入口（需模型）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ConflictDispositionAction, ConflictRecord } from "@/domain/models/conflict-record";
import { SETTING_CARD_TIERS, type SettingCardTier } from "@/domain/models/setting-card";

export interface ConflictCardProps {
  conflict: ConflictRecord;
  /** 当前进行中的动作（禁用全部按钮，避免并发处置） */
  busyAction: ConflictDispositionAction | null;
  /** 是否可用「语义复核」（需已配置模型） */
  canReview: boolean;
  reviewing: boolean;
  onResolve: (
    conflict: ConflictRecord,
    action: ConflictDispositionAction,
    options?: { tier?: SettingCardTier },
  ) => void;
  onReview: (conflict: ConflictRecord) => void;
}

/** 单条冲突卡片 */
export function ConflictCard({
  conflict,
  busyAction,
  canReview,
  reviewing,
  onResolve,
  onReview,
}: ConflictCardProps) {
  const { t } = useTranslation("consistency");
  const [tier, setTier] = useState<SettingCardTier>("short");
  const busy = busyAction !== null || reviewing;

  return (
    <section
      data-testid="conflict-card"
      data-status={conflict.status}
      className="flex flex-col gap-1 rounded-md border p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {t(`type.${conflict.type}`)} · #{conflict.aId} / #{conflict.bId}
        </span>
        <span className="text-xs opacity-70">{t(`severity.${conflict.severity}`)}</span>
        <span className="text-xs opacity-70">{t(`status.${conflict.status}`)}</span>
        {conflict.action && (
          <span className="text-xs opacity-70">{t(`action.${conflict.action}`)}</span>
        )}
      </div>
      <p className="text-xs opacity-70">{t("evidenceLabel", { text: conflict.evidence })}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs">
          {t("tier")}
          <select
            data-testid="conflict-tier"
            className="rounded border px-1"
            value={tier}
            onChange={(event) => setTier(event.target.value as SettingCardTier)}
          >
            {SETTING_CARD_TIERS.map((value) => (
              <option key={value} value={value}>
                {t(`tier.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <Button
          data-testid="action-change-tier"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onResolve(conflict, "change_tier", { tier })}
        >
          {t("changeTier")}
        </Button>
        <Button
          data-testid="action-edit"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onResolve(conflict, "edit")}
        >
          {t("editCard")}
        </Button>
        <Button
          data-testid="action-false-positive"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onResolve(conflict, "false_positive")}
        >
          {t("markFalsePositive")}
        </Button>
        <Button
          data-testid="action-ignore"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onResolve(conflict, "ignore")}
        >
          {t("ignore")}
        </Button>
        {canReview && (
          <Button
            data-testid="action-review-l2"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onReview(conflict)}
          >
            {t("reviewSemantic")}
          </Button>
        )}
      </div>
    </section>
  );
}

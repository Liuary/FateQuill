/**
 * 单分支走向卡（stage-08 T2/T3/T4）
 *
 * 职责：展示一个温度分支的走向卡（温度 / `clamped` 标注 / `summary` / `keyTurns` / 设定卡引用；
 * **独有关键转折**高亮；**偏离标注 + 降权弱化**）；并提供三动作：
 * **「采纳为下一章」（主路径，无 DB 丢失）**、**「替换当前章（危险）」**（经二次确认）、**「丢弃」**。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { BranchDiff } from "@/orchestration/exploration/diff";
import type { ExplorationBranch } from "@/orchestration/exploration/types";
import { ConfirmInline } from "./ConfirmInline";

export interface BranchCardProps {
  branch: ExplorationBranch;
  diff: BranchDiff;
  collapsed: boolean;
  selected: boolean;
  onToggleCollapsed: () => void;
  onSelect: () => void;
  /** 主路径：新建下一章草稿（**不改当前章**） */
  onAdoptNextChapter: (branchId: string) => Promise<boolean>;
  /** 次路径（危险）：替换当前章（内部先强制入池快照） */
  onReplaceCurrent: (branchId: string) => boolean;
  /** 丢弃分支 */
  onDiscard: (branchId: string) => void;
  /** 失败分支单独重试（T5） */
  onRetry: (branchId: string) => Promise<boolean> | void;
}

/** 单分支走向卡 */
export function BranchCard({
  branch,
  diff,
  collapsed,
  selected,
  onToggleCollapsed,
  onSelect,
  onAdoptNextChapter,
  onReplaceCurrent,
  onDiscard,
  onRetry,
}: BranchCardProps) {
  const { t } = useTranslation("exploration");
  const uniqueTurns = new Set(diff.uniqueKeyTurns);
  // 二次确认门：未确认不执行任何落地动作
  const [pendingAction, setPendingAction] = useState<"next" | "replace" | null>(null);
  const [snapshotSaved, setSnapshotSaved] = useState(false);

  return (
    <article
      data-testid="branch-card"
      data-selected={selected}
      className={
        (selected
          ? "border-primary flex flex-col gap-1 rounded border-2 p-2 text-sm"
          : "border-border/40 flex flex-col gap-1 rounded border p-2 text-sm") +
        (branch.deviation?.flagged ? " opacity-60" : "") // 降权：视觉弱化（不隐藏）
      }
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs opacity-70">
          {t("temperatureLabel")}: {branch.temperature}（{t("effectiveLabel")}:{" "}
          {branch.effectiveTemperature}）
        </span>
        {branch.clamped && <span className="text-xs opacity-70">{t("clamped")}</span>}
        <Button variant="outline" onClick={onToggleCollapsed}>
          {collapsed ? t("expand") : t("collapse")}
        </Button>
        <Button variant="outline" onClick={onSelect}>
          {t("select")}
        </Button>
      </header>

      {!collapsed &&
        (branch.card ? (
          <>
            {branch.deviation?.flagged && (
              <span data-testid="deviation-flag" className="text-destructive text-xs">
                {t("flagged")}
              </span>
            )}
            <p>{branch.card.summary}</p>
            {branch.deviation && (
              <p className="text-xs opacity-70" data-testid="deviation-detail">
                {t("coverage")}: {branch.deviation.coverage.toFixed(2)}
                {branch.deviation.missingSettingCardIds.length > 0
                  ? ` ｜ ${t("missingSettings")}: ${branch.deviation.missingSettingCardIds.join(", ")}`
                  : ""}
                {branch.deviation.invalidSettingCardIds.length > 0
                  ? ` ｜ ${t("invalidRefs")}: ${branch.deviation.invalidSettingCardIds.join(", ")}`
                  : ""}
              </p>
            )}
            {branch.card.keyTurns.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs">
                {branch.card.keyTurns.map((turn) => {
                  const isUnique = uniqueTurns.has(turn);
                  return (
                    <li
                      key={turn}
                      data-testid={isUnique ? "unique-turn" : "shared-turn"}
                      className={isUnique ? "font-medium" : "opacity-70"}
                    >
                      {isUnique ? `◆ ${turn}` : turn}
                    </li>
                  );
                })}
              </ul>
            )}
            {branch.card.settingCardIds.length > 0 && (
              <p className="text-xs opacity-70">
                {t("settingRefs")}: {branch.card.settingCardIds.join(", ")}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPendingAction("next")}>
                {t("adoptNextChapter")}
              </Button>
              <Button variant="outline" onClick={() => setPendingAction("replace")}>
                {t("replaceCurrent")}
              </Button>
              <Button variant="outline" onClick={() => onDiscard(branch.id)}>
                {t("discard")}
              </Button>
            </div>

            {snapshotSaved && <p className="text-xs opacity-70">{t("snapshotSaved")}</p>}

            {pendingAction === "next" && (
              <ConfirmInline
                prompt={t("confirmNextChapter")}
                onConfirm={() => {
                  setPendingAction(null);
                  void onAdoptNextChapter(branch.id);
                }}
                onCancel={() => setPendingAction(null)}
              />
            )}
            {pendingAction === "replace" && (
              <ConfirmInline
                prompt={t("dangerWarning")}
                onConfirm={() => {
                  setPendingAction(null);
                  if (onReplaceCurrent(branch.id)) {
                    setSnapshotSaved(true);
                  }
                }}
                onCancel={() => setPendingAction(null)}
              />
            )}
          </>
        ) : branch.error ? (
          <>
            <p className="text-destructive text-xs">{branch.error}</p>
            {/* 部分结果可用：失败分支单独重试 */}
            <Button variant="outline" onClick={() => void onRetry(branch.id)}>
              {t("retry")}
            </Button>
          </>
        ) : (
          <p className="text-xs opacity-70">{t("statusPending")}</p>
        ))}
    </article>
  );
}

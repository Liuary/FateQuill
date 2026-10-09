/**
 * 单分支走向卡（stage-08 T2）
 *
 * 职责：展示一个温度分支的走向卡（温度 / `clamped` 标注 / `summary` / `keyTurns` / 设定卡引用）；
 * **独有关键转折**（`uniqueKeyTurns`）以左侧标记 + 加粗高亮。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { BranchDiff } from "@/orchestration/exploration/diff";
import type { ExplorationBranch } from "@/orchestration/exploration/types";

export interface BranchCardProps {
  branch: ExplorationBranch;
  diff: BranchDiff;
  collapsed: boolean;
  selected: boolean;
  onToggleCollapsed: () => void;
  onSelect: () => void;
}

/** 单分支走向卡 */
export function BranchCard({
  branch,
  diff,
  collapsed,
  selected,
  onToggleCollapsed,
  onSelect,
}: BranchCardProps) {
  const { t } = useTranslation("exploration");
  const uniqueTurns = new Set(diff.uniqueKeyTurns);

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
          </>
        ) : branch.error ? (
          <p className="text-destructive text-xs">{branch.error}</p>
        ) : (
          <p className="text-xs opacity-70">{t("statusPending")}</p>
        ))}
    </article>
  );
}

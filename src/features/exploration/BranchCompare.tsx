/**
 * 分支对比视图（stage-08 T2）
 *
 * 职责：把 `explorationStore.branches` **按温度排序**后**并排**展示（窄屏单列、宽屏多列），
 * 每卡可**折叠/展开**、可选中；顶部给出差异图例，卡片内标注**独有关键转折**。
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { diffBranches, type BranchDiff } from "@/orchestration/exploration/diff";
import { useExplorationStore } from "@/store/explorationStore";
import { BranchCard } from "./BranchCard";

const EMPTY_DIFF = (branchId: string): BranchDiff => ({
  branchId,
  uniqueKeyTurns: [],
  sharedKeyTurns: [],
});

/** 分支对比视图（并排 + 折叠 + 差异标注） */
export function BranchCompare() {
  const { t } = useTranslation("exploration");
  const branches = useExplorationStore((s) => s.branches);
  const collapsedIds = useExplorationStore((s) => s.collapsedIds);
  const selectedBranchId = useExplorationStore((s) => s.selectedBranchId);
  const toggleCollapsed = useExplorationStore((s) => s.toggleCollapsed);
  const selectBranch = useExplorationStore((s) => s.selectBranch);

  // 并排顺序：按温度升序（与分支创建顺序解耦）
  const ordered = useMemo(
    () => [...branches].sort((a, b) => a.temperature - b.temperature),
    [branches],
  );
  const diffs = useMemo(
    () => new Map(diffBranches(ordered).map((diff) => [diff.branchId, diff])),
    [ordered],
  );

  if (ordered.length === 0) {
    return <p className="text-xs opacity-70">{t("empty")}</p>;
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs opacity-70">
        {t("compare")}（{ordered.length}）
      </h3>
      <p className="text-xs opacity-70">
        ◆ {t("unique")} ｜ {t("shared")}
      </p>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {ordered.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            diff={diffs.get(branch.id) ?? EMPTY_DIFF(branch.id)}
            collapsed={collapsedIds.includes(branch.id)}
            selected={selectedBranchId === branch.id}
            onToggleCollapsed={() => toggleCollapsed(branch.id)}
            onSelect={() => selectBranch(branch.id)}
          />
        ))}
      </div>
    </section>
  );
}

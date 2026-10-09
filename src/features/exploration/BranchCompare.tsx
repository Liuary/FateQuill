/**
 * 分支对比视图（stage-08 T2/T4）
 *
 * 职责：把 `explorationStore.branches` 按**收敛权重降序**（并列取温度升序）**并排**展示
 * （窄屏单列、宽屏多列），每卡可**折叠/展开**、可选中、可**采纳/替换/丢弃**（前两者经二次确认）。
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { diffBranches, type BranchDiff } from "@/orchestration/exploration/diff";
import { useExplorationStore } from "@/store/explorationStore";
import { BranchCard } from "./BranchCard";
import { useAdoptBranch } from "./useAdoptBranch";

const EMPTY_DIFF = (branchId: string): BranchDiff => ({
  branchId,
  uniqueKeyTurns: [],
  sharedKeyTurns: [],
});

export interface BranchCompareProps {
  /** 供次路径 `replaceContent` 使用（T4） */
  editor?: Editor | null;
  /** 当前章 id（主路径新建下一章需要其卷） */
  currentChapterId?: number | null;
}

/** 分支对比视图（并排 + 折叠 + 差异标注 + 采纳/替换/丢弃） */
export function BranchCompare({ editor = null, currentChapterId = null }: BranchCompareProps) {
  const { t } = useTranslation("exploration");
  const branches = useExplorationStore((s) => s.branches);
  const collapsedIds = useExplorationStore((s) => s.collapsedIds);
  const selectedBranchId = useExplorationStore((s) => s.selectedBranchId);
  const toggleCollapsed = useExplorationStore((s) => s.toggleCollapsed);
  const selectBranch = useExplorationStore((s) => s.selectBranch);
  const { adoptAsNextChapter, replaceCurrentChapter, discard } = useAdoptBranch(editor);

  // 并排顺序：收敛权重降序（偏离分支被降权）；权重并列或无权重 → 温度升序（稳定排序）
  const ordered = useMemo(
    () =>
      [...branches].sort((a, b) => {
        const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
        return weightDiff !== 0 ? weightDiff : a.temperature - b.temperature;
      }),
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
            onAdoptNextChapter={(branchId) =>
              currentChapterId == null
                ? Promise.resolve(false)
                : adoptAsNextChapter(branchId, currentChapterId)
            }
            onReplaceCurrent={(branchId) =>
              replaceCurrentChapter(branchId, editor?.getHTML() ?? "")
            }
            onDiscard={discard}
          />
        ))}
      </div>
    </section>
  );
}

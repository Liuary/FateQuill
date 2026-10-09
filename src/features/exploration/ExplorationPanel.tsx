/**
 * 推演面板（stage-08 T1）
 *
 * 职责：走向意向输入 + 温度集配置 + 「运行/停止」+ 分支列表（温度 / 有效温度 / **clamp 标注** /
 * 状态 / 走向摘要预览）；空态与 Key 引导。
 *
 * `editor` 供 T4「采纳」使用（`replaceContent`），T1 暂未使用。
 */

import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenerationAvailability } from "@/features/generation/useGenerationAvailability";
import { useExplorationStore } from "@/store/explorationStore";
import { BranchCompare } from "./BranchCompare";
import { IChingPanel } from "./IChingPanel";
import { TemperatureConfig } from "./TemperatureConfig";
import { useExploration } from "./useExploration";

export interface ExplorationPanelProps {
  novelId: number | null;
  chapterId: number | null;
  /** 供 T4 采纳（`replaceContent`）使用；T1 未使用 */
  editor?: Editor | null;
}

/** 多温度并行推演面板 */
export function ExplorationPanel({ novelId, chapterId, editor = null }: ExplorationPanelProps) {
  const { t } = useTranslation("exploration");
  const { state, config } = useGenerationAvailability();
  const intent = useExplorationStore((s) => s.intent);
  const setIntent = useExplorationStore((s) => s.setIntent);
  const branches = useExplorationStore((s) => s.branches);
  const running = useExplorationStore((s) => s.running);
  const { run, retryBranch, abort, concurrency, setConcurrency, cost } = useExploration({
    novelId,
    chapterId,
    config,
  });

  const canRun = state === "ready" && novelId != null && intent.trim().length > 0 && !running;

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>

      {(state === "no-config" || state === "no-key") && (
        <p className="text-destructive">{t("guideSettings")}</p>
      )}

      <label className="flex flex-col gap-1">
        {t("intent")}
        <Input value={intent} onChange={(event) => setIntent(event.target.value)} />
      </label>

      <TemperatureConfig />

      <IChingPanel />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          {t("concurrency")}
          <Input
            type="number"
            min={1}
            max={10}
            className="w-16"
            value={concurrency}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value >= 1) {
                setConcurrency(Math.trunc(value));
              }
            }}
          />
        </label>
        {/* 成本预估：启动前显示（口径注明） */}
        <span data-testid="cost-estimate" className="opacity-70">
          {t("costEstimate")}: {cost.tokens} tokens（{cost.note}）
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!canRun} onClick={() => void run()}>
          {t("run")}
        </Button>
        {running && (
          <Button variant="outline" onClick={abort}>
            {t("stop")}
          </Button>
        )}
      </div>
      {running && <p className="text-xs opacity-70">{t("running")}</p>}

      <section className="flex flex-col gap-1">
        <h3 className="text-xs opacity-70">
          {t("branch")}（{branches.length}）
        </h3>
        <BranchCompare editor={editor} currentChapterId={chapterId} onRetry={retryBranch} />
      </section>
    </div>
  );
}

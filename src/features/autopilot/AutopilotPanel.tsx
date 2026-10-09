/**
 * 全自动创作面板（stage-12 T2）
 *
 * 职责：大纲输入（每行一章）+ 配置（章数 / 重写轮数 / 阈值 / 归档自动确认）+ 「启动全自动」/「停止」
 * + 进度与报告区（逐章状态：达阈 / 降级原因）。
 *
 * **零人工交互**：启动后链路自行推进（面板不弹确认、不等待点击）；停止是唯一的用户动作。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultAutopilotConfig, shouldAutoConfirmArchive } from "@/orchestration/autopilot";
import type { AutopilotRun } from "@/domain/models/autopilot";
import { repositories } from "@/ipc/repositories";
import { useGenerationAvailability } from "@/features/generation/useGenerationAvailability";
import { useAutopilotStore } from "@/store/autopilotStore";
import { parseOutline } from "./parse-outline";
import { useAutopilot } from "./useAutopilot";
import { useAutopilotRun } from "./useAutopilotRun";

export interface AutopilotPanelProps {
  novelId: number | null;
  chapterId?: number | null;
}

/** 全自动创作面板 */
export function AutopilotPanel({ novelId, chapterId = null }: AutopilotPanelProps) {
  const { t } = useTranslation("autopilot");
  const { state, config: modelConfig } = useGenerationAvailability();

  const [outlineText, setOutlineText] = useState("");
  const [maxChapters, setMaxChapters] = useState(3);
  const [maxRewriteRounds, setMaxRewriteRounds] = useState(2);
  const [passThreshold, setPassThreshold] = useState(60);
  const [autoConfirmArchive, setAutoConfirmArchive] = useState(true);

  const autopilotConfig = defaultAutopilotConfig({
    maxChapters,
    maxRewriteRounds,
    passThreshold,
    autoConfirmArchive,
  });
  const { deps } = useAutopilot({
    config: modelConfig,
    novelId,
    chapterId,
    autoConfirmArchive: shouldAutoConfirmArchive(autopilotConfig),
  });
  const { run, resume, stop } = useAutopilotRun(deps);

  const status = useAutopilotStore((s) => s.status);
  const currentIndex = useAutopilotStore((s) => s.currentIndex);
  const total = useAutopilotStore((s) => s.total);
  const chapters = useAutopilotStore((s) => s.chapters);
  const report = useAutopilotStore((s) => s.report);

  const [resumable, setResumable] = useState<AutopilotRun[]>([]);

  // 可续跑轮次（`running` / `paused`）——「继续上次」入口的数据源（运行状态变化时刷新）
  useEffect(() => {
    let alive = true;
    if (novelId == null) {
      return;
    }
    void repositories.autopilot.listRuns(novelId).then(
      (runs) => {
        if (alive) {
          setResumable(
            runs.filter((entry) => entry.status === "running" || entry.status === "paused"),
          );
        }
      },
      () => {
        // 读取失败（IPC 未就绪）：无续跑入口，不阻断启动
        if (alive) {
          setResumable([]);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [novelId, status]);

  const outline = parseOutline(outlineText);
  const running = status === "running";
  const canStart = deps != null && outline.length > 0 && !running;

  return (
    <div data-testid="autopilot-panel" className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>
      <p className="text-xs opacity-70">{t("guidance")}</p>

      {(state === "no-config" || state === "no-key") && (
        <p className="text-destructive">{t("guideSettings")}</p>
      )}

      <label className="flex flex-col gap-1 text-xs">
        {t("outline")}
        <textarea
          data-testid="autopilot-outline"
          className="border-input min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
          placeholder={t("outlinePlaceholder")}
          value={outlineText}
          onChange={(event) => setOutlineText(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          {t("maxChapters")}
          <Input
            data-testid="autopilot-max-chapters"
            type="number"
            min={1}
            max={50}
            className="w-16"
            value={maxChapters}
            onChange={(event) =>
              setMaxChapters(Math.max(1, Math.trunc(Number(event.target.value) || 1)))
            }
          />
        </label>
        <label className="flex items-center gap-1">
          {t("maxRewriteRounds")}
          <Input
            data-testid="autopilot-max-rewrites"
            type="number"
            min={0}
            max={5}
            className="w-16"
            value={maxRewriteRounds}
            onChange={(event) =>
              setMaxRewriteRounds(Math.max(0, Math.trunc(Number(event.target.value) || 0)))
            }
          />
        </label>
        <label className="flex items-center gap-1">
          {t("passThreshold")}
          <Input
            data-testid="autopilot-threshold"
            type="number"
            min={0}
            max={100}
            className="w-16"
            value={passThreshold}
            onChange={(event) => setPassThreshold(Math.trunc(Number(event.target.value) || 0))}
          />
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            data-testid="autopilot-auto-confirm"
            checked={autoConfirmArchive}
            onChange={(event) => setAutoConfirmArchive(event.target.checked)}
          />
          {t("autoConfirmArchive")}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="autopilot-start"
          disabled={!canStart}
          onClick={() => void run(outline, autopilotConfig)}
        >
          {t("start")}
        </Button>
        {running && (
          <Button data-testid="autopilot-stop" variant="outline" onClick={stop}>
            {t("stop")}
          </Button>
        )}
        {!running &&
          resumable.map((entry) => (
            <Button
              key={entry.id}
              data-testid="autopilot-resume"
              variant="outline"
              disabled={deps == null}
              onClick={() => void resume(entry.id)}
            >
              {t("resume", { id: entry.id })}
            </Button>
          ))}
      </div>

      {!running && resumable.length > 0 && (
        <p className="text-xs opacity-70">{t("resumeHint", { count: resumable.length })}</p>
      )}

      {status !== "idle" && (
        <p data-testid="autopilot-progress" className="text-xs opacity-70">
          {t(`status.${status}`)}：{Math.min(currentIndex + 1, total)}/{total}
        </p>
      )}

      {chapters.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs opacity-70">{t("chapters")}</h3>
          {chapters.map((chapter) => (
            <p
              key={`${chapter.index}-${chapter.title}`}
              data-testid="autopilot-chapter"
              className="text-xs"
            >
              {chapter.title}：
              {chapter.degraded
                ? `${t("degraded")}（${chapter.degradedReason ?? ""}）`
                : `${t("passed")} ${chapter.score ?? "-"}（${t("rounds", { count: chapter.rounds })}）`}
            </p>
          ))}
        </section>
      )}

      {report && (
        <p data-testid="autopilot-report" className="text-xs opacity-70">
          {t("report", {
            passed: report.passed,
            degraded: report.degraded,
            total: report.chapters.length,
          })}
        </p>
      )}
    </div>
  );
}

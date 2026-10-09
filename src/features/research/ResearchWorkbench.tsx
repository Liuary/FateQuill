/**
 * 研究工作台（stage-07 T1）
 *
 * 职责：多模型**采样模式**入口 —— 列出全部 `model_config` 供勾选（≥1）、输入自由创作指令、
 * 「开始采样」/「停止采样」、展示素材候选（来源模型 + 文本预览）；空态 / Key 引导。
 * 采样产出**仅入候选**，不进正文、不触发审查。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResearchStore } from "@/store/researchStore";
import { AnnotationPanel } from "./AnnotationPanel";
import { SkillLibrary } from "./SkillLibrary";
import { buildSelectedModels, useSampling } from "./useSampling";
import { useCrossJudge } from "./useCrossJudge";

/** 研究/采样工作台 */
export function ResearchWorkbench() {
  const { t } = useTranslation("research");
  const {
    options,
    loading,
    sampling,
    selectedConfigIds,
    setSelectedConfigIds,
    canSample,
    missingKey,
    startSampling,
    stopSampling,
  } = useSampling();
  const candidates = useResearchStore((s) => s.candidates);
  const [instruction, setInstruction] = useState("");

  // 交叉判断（REV-018）：复用勾选模型，对已有采样候选逐模型摘取 → 精确交集 → 待确认队列
  const models = buildSelectedModels(options, selectedConfigIds);
  const { runCrossJudge, stopCrossJudge, crossing } = useCrossJudge(models);

  const toggle = (id: number) => {
    setSelectedConfigIds(
      selectedConfigIds.includes(id)
        ? selectedConfigIds.filter((current) => current !== id)
        : [...selectedConfigIds, id],
    );
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
      <h2 className="font-medium">{t("workbench")}</h2>

      {loading ? (
        <p className="opacity-70">{t("loading")}</p>
      ) : options.length === 0 ? (
        <p className="text-destructive">{t("guideSettings")}</p>
      ) : (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs opacity-70">{t("models")}</h3>
          {options.map((option) => (
            <label key={option.config.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedConfigIds.includes(option.config.id)}
                onChange={() => toggle(option.config.id)}
              />
              <span>{option.config.label}</span>
              <span className="text-xs opacity-70">
                {option.config.provider} / {option.config.modelName}
              </span>
              {!option.hasKey && (
                <span className="text-destructive text-xs">{t("keyMissing")}</span>
              )}
            </label>
          ))}
        </section>
      )}

      {missingKey && <p className="text-destructive text-xs">{t("guideSettings")}</p>}

      <label className="flex flex-col gap-1">
        {t("instruction")}
        <Input value={instruction} onChange={(event) => setInstruction(event.target.value)} />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!canSample} onClick={() => void startSampling(instruction)}>
          {t("startSampling")}
        </Button>
        {sampling && (
          <Button variant="outline" onClick={stopSampling}>
            {t("stopSampling")}
          </Button>
        )}
        <Button
          disabled={!canSample || candidates.length === 0 || crossing}
          onClick={() => void runCrossJudge()}
        >
          {t("startCrossJudge")}
        </Button>
        {crossing && (
          <Button variant="outline" onClick={stopCrossJudge}>
            {t("stopCrossJudge")}
          </Button>
        )}
      </div>

      {candidates.length === 0 && (
        <p className="text-xs opacity-70">{t("crossJudgeNeedsCandidates")}</p>
      )}

      <section className="flex flex-col gap-1">
        <h3 className="text-xs opacity-70">
          {t("candidates")}（{candidates.length}）
        </h3>
        {candidates.length === 0 ? (
          <p className="text-xs opacity-70">{t("emptyCandidates")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {candidates.map((candidate) => (
              <li
                key={candidate.id}
                data-testid="material-candidate"
                className="border-border/40 rounded border p-1"
              >
                <span className="text-xs opacity-70">{candidate.sourceModel}</span>
                <p className="whitespace-pre-wrap">{candidate.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AnnotationPanel />

      <SkillLibrary />
    </div>
  );
}

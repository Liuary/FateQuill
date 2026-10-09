/**
 * 标注工作台（stage-07 T3）
 *
 * 职责：列出**待确认队列**（交叉判断）与**采样候选**，支持「从零手选片段」；选择片段后
 * 编辑引文 / 定位正文 → 定位预览（多命中提示）→ 理由 + **受控标签** + 备注 → 保存入库。
 * `source_type` 按被标注项**自带通道透传**（REV-011）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MaterialSourceType } from "@/domain/models/material";
import { RESEARCH_TAGS, type ResearchTag } from "@/orchestration/research/tags";
import { useResearchStore } from "@/store/researchStore";
import { locateExcerpt } from "./locate";
import { useAnnotation } from "./useAnnotation";

/** 标注区的来源上下文（通道 + 来源模型） */
interface AnnotationSource {
  sourceType: MaterialSourceType;
  sourceModel: string;
}

/** 用户标注工作台 */
export function AnnotationPanel() {
  const { t } = useTranslation("research");
  const pendingResults = useResearchStore((s) => s.pendingResults);
  const candidates = useResearchStore((s) => s.candidates);
  const { save, saving, error } = useAnnotation();

  const [source, setSource] = useState<AnnotationSource | null>(null);
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState<ResearchTag>(RESEARCH_TAGS[0]);
  const [note, setNote] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const located = content && excerpt ? locateExcerpt(content, excerpt) : null;

  const pickCross = (crossExcerpt: string, models: string[]) => {
    setSource({ sourceType: "multi_model_cross", sourceModel: models.join(",") }); // 交叉通道
    setExcerpt(crossExcerpt);
    setContent("");
  };

  const pickCandidate = (candidateContent: string, sourceModel: string) => {
    setSource({ sourceType: "multi_model_creation", sourceModel }); // 采样通道
    setContent(candidateContent);
    setExcerpt(candidateContent.slice(0, 20));
  };

  const pickManual = () => {
    setSource({ sourceType: "user_manual", sourceModel: "" }); // 从零手选：用户手动通道
    setContent("");
    setExcerpt("");
  };

  const handleSave = async () => {
    if (!source || excerpt.trim().length === 0) {
      return;
    }
    const saved = await save(
      { excerpt: excerpt.trim(), sourceType: source.sourceType, sourceModel: source.sourceModel },
      { reason, tag, note },
      content,
    );
    if (saved) {
      setSavedCount((count) => count + 1);
      setExcerpt("");
      setReason("");
      setNote("");
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">{t("annotation")}</h3>

      <div className="flex flex-col gap-1">
        <h4 className="text-xs opacity-70">{t("pending")}</h4>
        {pendingResults.length === 0 ? (
          <p className="text-xs opacity-70">{t("emptyPending")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pendingResults.map((result) => (
              <li
                key={result.excerpt}
                data-testid="pending-result"
                className="border-border/40 flex items-center justify-between gap-2 rounded border p-1"
              >
                <span>
                  {result.excerpt}
                  <span className="text-xs opacity-70"> [{result.models.join("/")}]</span>
                </span>
                <Button variant="outline" onClick={() => pickCross(result.excerpt, result.models)}>
                  {t("label")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="text-xs opacity-70">{t("candidates")}</h4>
        {candidates.length === 0 ? (
          <p className="text-xs opacity-70">{t("emptyCandidates")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {candidates.map((candidate) => (
              <li
                key={candidate.id}
                data-testid="annotation-candidate"
                className="border-border/40 flex items-center justify-between gap-2 rounded border p-1"
              >
                <span>
                  <span className="text-xs opacity-70">{candidate.sourceModel} </span>
                  {candidate.content.slice(0, 30)}…
                </span>
                <Button
                  variant="outline"
                  onClick={() => pickCandidate(candidate.content, candidate.sourceModel)}
                >
                  {t("label")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button variant="outline" onClick={pickManual}>
        {t("manualPick")}
      </Button>

      {source ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs opacity-70">
            {t("source")}: {source.sourceType}
          </p>

          <label className="flex flex-col gap-1">
            {t("excerpt")}
            <Input value={excerpt} onChange={(event) => setExcerpt(event.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            {t("locateContent")}
            <textarea
              className="border-input min-h-16 rounded border p-1"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>

          {located && located.index >= 0 && (
            <p className="text-xs opacity-70">
              {t("locateHit", { index: located.index })}
              {located.ambiguous ? ` ｜ ${t("ambiguous", { matches: located.matches })}` : ""}
            </p>
          )}
          {located && located.index < 0 && <p className="text-xs opacity-70">{t("locateMiss")}</p>}

          <label className="flex flex-col gap-1">
            {t("reason")}
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>

          <label className="flex items-center gap-2">
            {t("tag")}
            <select
              className="border-input rounded border p-1"
              value={tag}
              onChange={(event) => setTag(event.target.value as ResearchTag)}
            >
              {RESEARCH_TAGS.map((value) => (
                <option key={value} value={value}>
                  {t(`tags.${value}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            {t("note")}
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          {error === "invalid-tag" && <p className="text-destructive text-xs">{t("invalidTag")}</p>}

          <div className="flex items-center gap-2">
            <Button
              disabled={saving || excerpt.trim().length === 0}
              onClick={() => void handleSave()}
            >
              {t("save")}
            </Button>
            <span className="text-xs opacity-70">{t("savedCount", { count: savedCount })}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * 归档面板（stage-11 T2）
 *
 * 职责：**手动「归档本章」**入口 + 待确认候选列表（展示 `name/kind/suggestedTier/evidence`，
 * 可逐条修正分级 / 移除），确认后经 `save_extracted_settings` **事务批落库**。
 *
 * tab 接入随 op-005 统一面板（本 op 仅交付组件与编排）。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SETTING_CARD_TIERS, type SettingCardTier } from "@/domain/models/setting-card";
import { useGenerationAvailability } from "@/features/generation/useGenerationAvailability";
import { useArchiveStore } from "@/store/archiveStore";
import { useArchiveChapter } from "./useArchiveChapter";

export interface ArchivePanelProps {
  novelId: number | null;
  chapterId?: number | null;
}

/** 归档本章面板 */
export function ArchivePanel({ novelId, chapterId = null }: ArchivePanelProps) {
  const { t } = useTranslation("consistency");
  const { state, config } = useGenerationAvailability();
  const { candidates, running, error, savedCount, archiveChapter, confirmAndSave, stop } =
    useArchiveChapter({ config, novelId, chapterId });
  const newCount = candidates.filter((candidate) => candidate.status === "new").length;

  return (
    <div data-testid="archive-panel" className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>
      <p className="text-xs opacity-70">{t("guidance")}</p>

      {(state === "no-config" || state === "no-key") && (
        <p className="text-destructive">{t("guideSettings")}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          data-testid="archive-button"
          variant="outline"
          disabled={running || config == null || chapterId == null}
          onClick={() => void archiveChapter()}
        >
          {t("archive")}
        </Button>
        {running && (
          <Button variant="outline" onClick={stop}>
            {t("stop")}
          </Button>
        )}
        {candidates.length > 0 && (
          <Button
            data-testid="archive-confirm"
            disabled={running || newCount === 0}
            onClick={() => void confirmAndSave()}
          >
            {t("confirmSave", { count: newCount })}
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-xs">{t("extractFailed")}</p>}
      {savedCount != null && (
        <p className="text-xs opacity-70">{t("saved", { count: savedCount })}</p>
      )}
      {candidates.length === 0 && !running && <p className="text-xs opacity-70">{t("empty")}</p>}

      {candidates.map((candidate, index) => (
        // 候选为**会话内存**条目（以索引为身份；无稳定 id）
        <section
          key={`${index}-${candidate.name}`}
          data-testid="archive-candidate"
          className="flex flex-col gap-1 rounded-md border p-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{candidate.name}</span>
            <span className="text-xs opacity-70">{candidate.kind}</span>
            {candidate.status === "duplicate" && (
              <span className="text-destructive text-xs">{t("duplicate")}</span>
            )}
            <label className="ml-auto flex items-center gap-1 text-xs">
              {t("tier")}
              <select
                data-testid="archive-tier"
                className="rounded border px-1"
                value={candidate.suggestedTier}
                onChange={(event) =>
                  useArchiveStore.getState().updateCandidate(index, {
                    suggestedTier: event.target.value as SettingCardTier,
                  })
                }
              >
                {SETTING_CARD_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {t(`tier.${tier}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              data-testid="archive-remove"
              variant="outline"
              size="sm"
              onClick={() => useArchiveStore.getState().removeCandidate(index)}
            >
              {t("remove")}
            </Button>
          </div>
          <p className="text-xs">{candidate.content}</p>
          <p className="text-xs opacity-70">{t("evidence", { text: candidate.evidence })}</p>
        </section>
      ))}
    </div>
  );
}

/**
 * 大六壬面板（stage-12 T1）
 *
 * 职责：**手动起课**——指定**月将 + 时辰 + 日干支**（**不引历法库**，方案 b）→ `castLiuren` 起课 →
 * 展示**课体 / 四课 / 三传 / 天盘 / 天将**（课体引导，非断卦）。
 * 起课结果写入 `explorationStore.liurenChart`（**跨组件共享**，供 `useExploration` 注入 `liurenGuide`）。
 *
 * **可选可关**：开关 UI 与易经对称地置于 `ExplorationPanel`（`data-testid="liuren-toggle"`）；
 * 本面板仅在开关开启时挂载（缺省关闭 → 零副作用）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { EARTHLY_BRANCHES, JIAZI_60 } from "@/data/liuren/ganzhi";
import { LIUREN_PALACES } from "@/data/liuren/palaces";
import { castLiuren } from "@/orchestration/liuren/cast";
import { buildLiurenCard } from "@/orchestration/liuren/guide";
import { useExplorationStore } from "@/store/explorationStore";

/** 大六壬起课面板（无 props：课体状态经 `explorationStore` 共享） */
export function LiurenPanel() {
  const { t } = useTranslation("liuren");
  const chart = useExplorationStore((s) => s.liurenChart);
  const setLiurenChart = useExplorationStore((s) => s.setLiurenChart);

  const [monthGeneral, setMonthGeneral] = useState("亥");
  const [hourBranch, setHourBranch] = useState("子");
  const [dayGanzhi, setDayGanzhi] = useState("甲子");
  const [error, setError] = useState<string | null>(null);

  function handleCast() {
    const result = castLiuren({ monthGeneral, hourBranch, dayGanzhi });
    if (!result.ok) {
      // 非法输入：早返回错误（不抛穿），不改动既有课体
      setError(result.error);
      return;
    }
    setError(null);
    setLiurenChart(result.chart);
  }

  const card = chart ? buildLiurenCard(chart) : null;

  return (
    <section
      data-testid="liuren-panel"
      className="flex flex-col gap-2 rounded-md border p-2 text-xs"
    >
      <h3 className="text-xs font-medium">{t("title")}</h3>
      <p className="opacity-70">{t("guide")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          {t("monthGeneral")}
          <select
            data-testid="liuren-month-general"
            className="rounded border px-1"
            value={monthGeneral}
            onChange={(event) => setMonthGeneral(event.target.value)}
          >
            {LIUREN_PALACES.map((palace) => (
              <option key={palace.branch} value={palace.branch}>
                {palace.generalName}（{palace.branch}）
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1">
          {t("hourBranch")}
          <select
            data-testid="liuren-hour-branch"
            className="rounded border px-1"
            value={hourBranch}
            onChange={(event) => setHourBranch(event.target.value)}
          >
            {EARTHLY_BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1">
          {t("dayGanzhi")}
          <select
            data-testid="liuren-day-ganzhi"
            className="rounded border px-1"
            value={dayGanzhi}
            onChange={(event) => setDayGanzhi(event.target.value)}
          >
            {JIAZI_60.map((ganzhi) => (
              <option key={ganzhi} value={ganzhi}>
                {ganzhi}
              </option>
            ))}
          </select>
        </label>

        <Button data-testid="liuren-cast" variant="outline" size="sm" onClick={handleCast}>
          {t("cast")}
        </Button>
      </div>

      {error && <p className="text-destructive text-xs">{t("castFailed")}</p>}

      {card && (
        <div data-testid="liuren-card" className="flex flex-col gap-1">
          <p className="font-medium">{card.title}</p>
          <p className="opacity-70">{card.subtitle}</p>
          <ul className="flex flex-col gap-0.5">
            <li>{card.lessons.join("｜")}</li>
            <li>{card.transmissions.join("｜")}</li>
          </ul>
          <p className="opacity-70">
            {t("heaven")}：{card.heavenSummary}
          </p>
          <p className="opacity-70">
            {t("generals")}：{card.generalsSummary}
          </p>
          <p className="opacity-70">{card.pattern}</p>
        </div>
      )}

      {!card && <p className="opacity-70">{t("empty")}</p>}
      <p className="opacity-70">{t("disclaimer")}</p>
    </section>
  );
}

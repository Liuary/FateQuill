/**
 * 起卦面板（stage-09 T2）
 *
 * 职责：**随机起卦**（可注入种子 → 可复现）与**手动起卦**（指定卦 + 变爻）；展示本卦/之卦、变爻高亮、
 * **朱熹解读指引**与应读**经文原文**（不译）。
 *
 * **不呈现时间起卦入口**（农历/干支）：v0.3 推迟（不引入历法依赖，C-08）。
 * 起卦结果写入 `explorationStore.casting`（REV-007 跨组件状态）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Hexagram } from "@/data/iching/types";
import { deriveHexagram, readingVerses } from "@/orchestration/iching/derive";
import { castManual, castRandom, createSeededRng } from "@/orchestration/iching/random";
import { useExplorationStore } from "@/store/explorationStore";

/** 默认种子（可复现） */
const DEFAULT_SEED = 42;

/** 爻象字符（阳 ▬ / 阴 ▬▬ 以文本呈现；自下而上显示时反转） */
function renderLineSymbol(yang: boolean): string {
  return yang ? "▬▬▬▬▬" : "▬▬ ▬▬";
}

/** 由下而上显示爻象（上爻在最上方） */
function LineColumn({ gua, changing }: { gua: Hexagram; changing: number[] }) {
  const rows = [...gua.binary].map((bit, index) => ({ index, yang: bit === "1" }));
  return (
    <ul className="flex flex-col gap-0.5 font-mono text-xs">
      {rows.reverse().map((row) => (
        <li
          key={row.index}
          data-testid={changing.includes(row.index) ? "changing-line" : "static-line"}
          className={changing.includes(row.index) ? "font-medium" : "opacity-70"}
        >
          {renderLineSymbol(row.yang)}
          {changing.includes(row.index) ? " ◆" : ""}
        </li>
      ))}
    </ul>
  );
}

/** 起卦面板 */
export function IChingPanel() {
  const { t } = useTranslation("iching");
  const casting = useExplorationStore((s) => s.casting);
  const setCasting = useExplorationStore((s) => s.setCasting);
  const [seed, setSeed] = useState(String(DEFAULT_SEED));
  const [manualBinary, setManualBinary] = useState("111111");
  const [manualChanging, setManualChanging] = useState("");

  const castByRandom = () => {
    const parsed = Number(seed);
    // 种子随机源（同种子 → 同卦，可复现）
    const rng = Number.isFinite(parsed) ? createSeededRng(parsed) : Math.random;
    setCasting(deriveHexagram(castRandom(rng)));
  };

  const castByManual = () => {
    const changing = manualChanging
      .split(/[\s,，]+/)
      .map((token) => Number(token.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 5);
    setCasting(deriveHexagram(castManual(manualBinary.trim(), changing)));
  };

  const readingKey = `reading${casting?.reading.changingCount ?? 0}` as const;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">{t("title")}</h3>

      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className="flex items-center gap-1">
          {t("seed")}
          <Input
            className="w-24"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            aria-label={t("seed")}
          />
        </label>
        <Button variant="outline" onClick={castByRandom}>
          {t("castRandom")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className="flex items-center gap-1">
          {t("manualBinary")}
          <Input
            className="w-28"
            value={manualBinary}
            onChange={(event) => setManualBinary(event.target.value)}
            aria-label={t("manualBinary")}
          />
        </label>
        <label className="flex items-center gap-1">
          {t("manualChanging")}
          <Input
            className="w-24"
            value={manualChanging}
            onChange={(event) => setManualChanging(event.target.value)}
            aria-label={t("manualChanging")}
          />
        </label>
        <Button variant="outline" onClick={castByManual}>
          {t("castManual")}
        </Button>
      </div>

      {casting ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-4">
            <div data-testid="ben-gua">
              <p className="text-xs opacity-70">{t("benGua")}</p>
              <p>{casting.benGua.name}</p>
              <LineColumn gua={casting.benGua} changing={casting.changingLines} />
            </div>
            <div data-testid="zhi-gua">
              <p className="text-xs opacity-70">{t("zhiGua")}</p>
              <p>{casting.zhiGua.name}</p>
              <LineColumn gua={casting.zhiGua} changing={[]} />
            </div>
          </div>

          <p className="text-xs opacity-70" data-testid="changing-count">
            {t("changingLines")}: {casting.changingLines.join(", ") || t("none")}
          </p>

          <div data-testid="zhuxi-reading">
            <p className="text-xs">{t(`reading.${readingKey}`)}</p>
            <ul className="flex flex-col gap-1">
              {readingVerses(casting).map((verse) => (
                <li key={verse} data-testid="reading-verse">
                  {verse}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-xs opacity-70">{t("empty")}</p>
      )}
    </section>
  );
}

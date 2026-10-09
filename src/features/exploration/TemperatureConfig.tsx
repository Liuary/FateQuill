/**
 * 温度集配置（stage-08 T1）
 *
 * 职责：增删 / 调值温度集 → `explorationStore` + `localStorage` 持久化。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTemperatures } from "@/orchestration/exploration/temperature";
import { useExplorationStore } from "@/store/explorationStore";

/** 新增温度的初值 */
const NEW_TEMPERATURE = 0.7;

/** 温度集配置（增删 / 调值） */
export function TemperatureConfig() {
  const { t } = useTranslation("exploration");
  const temperatures = useExplorationStore((s) => s.temperatures);
  const setTemperatures = useExplorationStore((s) => s.setTemperatures);

  const commit = (next: number[]) => {
    setTemperatures(next);
    saveTemperatures(next); // 持久化（键 fatequill.exploration.temperatures）
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs opacity-70">{t("temperatures")}</span>
      {temperatures.map((temperature, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            type="number"
            step={0.1}
            min={0}
            max={2}
            className="w-20"
            aria-label={`${t("temperatureLabel")}-${index}`}
            value={temperature}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                commit(temperatures.map((current, i) => (i === index ? value : current)));
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => commit(temperatures.filter((_, i) => i !== index))}
          >
            {t("removeTemp")}
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => commit([...temperatures, NEW_TEMPERATURE])}
      >
        {t("addTemp")}
      </Button>
    </div>
  );
}

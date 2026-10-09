/**
 * 宿命提示面板（stage-09 T4）
 *
 * 职责：起卦后选定**目标（角色 / 设定卡）** → 产出**一次性宿命提示卡** → **写入 `setting_card`**
 * （`kind="fate"`；复用既有编辑链路，**零迁移**；REV-008：写入**收敛为仅新建宿命卡**单一路径）。
 *
 * 门控由上层（`ExplorationPanel` + `useIChingEnabled`）负责：未开启时本组件不渲染。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { repositories } from "@/ipc/repositories";
import { buildFateCard, type FateCard } from "@/orchestration/iching/fate";
import { useExplorationStore } from "@/store/explorationStore";

export interface FatePanelProps {
  novelId: number | null;
}

/** 产出目标（角色 / 设定卡） */
interface FateTarget {
  id: string;
  name: string;
  kind: "character" | "settingCard";
}

/** 加载可选目标（角色 + 既有设定卡） */
async function loadTargets(novelId: number): Promise<FateTarget[]> {
  const [characters, settingCards] = await Promise.all([
    repositories.character.listByNovel(novelId),
    repositories.settingCard.listByNovel(novelId),
  ]);
  return [
    ...characters.map((character) => ({
      id: `character-${character.id}`,
      name: character.name,
      kind: "character" as const,
    })),
    ...settingCards.map((card) => ({
      id: `settingCard-${card.id}`,
      name: card.title,
      kind: "settingCard" as const,
    })),
  ];
}

/** 宿命提示面板（一次性） */
export function FatePanel({ novelId }: FatePanelProps) {
  const { t } = useTranslation("iching");
  const casting = useExplorationStore((s) => s.casting);
  const [targets, setTargets] = useState<FateTarget[]>([]);
  const [targetId, setTargetId] = useState("");
  const [fate, setFate] = useState<FateCard | null>(null);
  const [written, setWritten] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (novelId == null) {
      return;
    }
    void loadTargets(novelId).then(
      (result) => {
        if (alive) {
          setTargets(result);
        }
      },
      () => {
        // 读取失败（IPC 未就绪）：空态
        if (alive) {
          setTargets([]);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [novelId]);

  const selected = targets.find((target) => target.id === targetId) ?? null;

  const generate = () => {
    if (!casting || !selected) {
      return;
    }
    setFate(buildFateCard(casting, selected.name));
    setWritten(false);
    setError(null);
  };

  const writeToCard = async () => {
    if (!fate || novelId == null) {
      return;
    }
    setError(null);
    try {
      // REV-008：写入**收敛为仅新建宿命卡**（单一路径）；复用既有编辑链路（零迁移）
      await repositories.settingCard.create({
        novelId,
        title: fate.title,
        content: fate.content,
        kind: "fate",
      });
      setWritten(true);
    } catch {
      // 写入失败：提示（不静默）
      setError("write-failed");
    }
  };

  return (
    <section data-testid="fate-panel" className="flex flex-col gap-2">
      <h3 className="font-medium">{t("fate")}</h3>

      <label className="flex flex-wrap items-center gap-2 text-xs">
        {t("target")}
        <select
          className="border-input rounded border p-1"
          value={targetId}
          onChange={(event) => {
            setTargetId(event.target.value);
            setFate(null);
            setWritten(false);
          }}
        >
          <option value="">{t("selectTarget")}</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              [{t(target.kind === "character" ? "character" : "settingCard")}] {target.name}
            </option>
          ))}
        </select>
      </label>

      {targets.length === 0 && <p className="text-xs opacity-70">{t("noTargets")}</p>}
      {!casting && <p className="text-xs opacity-70">{t("emptyCasting")}</p>}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!casting || !selected} onClick={generate}>
          {t("generateFate")}
        </Button>
        <Button variant="outline" disabled={!fate} onClick={() => void writeToCard()}>
          {t("writeToCard")}
        </Button>
      </div>

      {fate && (
        <div
          data-testid="fate-card"
          className="border-border/40 flex flex-col gap-1 rounded border p-1 text-xs"
        >
          <p>{fate.title}</p>
          <pre className="font-sans whitespace-pre-wrap">{fate.content}</pre>
        </div>
      )}

      {written && <p className="text-xs opacity-70">{t("written")}</p>}
      {error === "write-failed" && (
        <p className="text-destructive text-xs">{t("fateWriteFailed")}</p>
      )}
    </section>
  );
}

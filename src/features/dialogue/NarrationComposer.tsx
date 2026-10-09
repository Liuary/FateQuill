/**
 * 旁白生成入口（stage-10 T2）
 *
 * **旁白 / 对话分离**：本组件只触发**旁白**生成（与角色台词入口独立）。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface NarrationComposerProps {
  running: boolean;
  onGenerate: () => void;
}

/** 旁白生成入口 */
export function NarrationComposer({ running, onGenerate }: NarrationComposerProps) {
  const { t } = useTranslation("dialogue");
  return (
    <div
      data-testid="narration-composer"
      className="border-border/40 flex flex-col gap-1 rounded border p-2"
    >
      <span className="text-xs opacity-70">{t("narration")}</span>
      <Button variant="outline" className="self-start" disabled={running} onClick={onGenerate}>
        {t("generateNarration")}
      </Button>
    </div>
  );
}

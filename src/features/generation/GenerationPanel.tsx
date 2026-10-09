import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenerationStore } from "@/store/generationStore";
import { useGenerationAvailability } from "./useGenerationAvailability";
import { useGeneration, type StartGenerationParams } from "./useGeneration";

export interface GenerationPanelProps {
  novelId: number | null;
  chapterId: number | null;
  editor: Editor | null;
}

/** 生成面板（**仅状态**：进度/停止/重试/错误 + 停止提示，无正文预览） */
export function GenerationPanel({ novelId, chapterId, editor }: GenerationPanelProps) {
  const { t } = useTranslation("generation");
  const { state, config } = useGenerationAvailability();
  const { start, stop } = useGeneration(editor);
  const status = useGenerationStore((s) => s.status);
  const chars = useGenerationStore((s) => s.progress.chars);
  const error = useGenerationStore((s) => s.error);
  const [instruction, setInstruction] = useState("");
  const lastParamsRef = useRef<StartGenerationParams | null>(null);

  const canStart =
    state === "ready" &&
    status !== "streaming" &&
    novelId != null &&
    chapterId != null &&
    editor != null;

  async function handleStart() {
    if (!config || novelId == null || chapterId == null) return;
    const params = { novelId, chapterId, userInstruction: instruction, config };
    lastParamsRef.current = params;
    await start(params);
  }

  async function handleRetry() {
    useGenerationStore.getState().reset(); // 清 error
    const last = lastParamsRef.current;
    if (last) await start(last);
    else await handleStart();
  }

  const showStoppedHint = status === "idle" && chars > 0 && error == null;

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <h2 className="font-medium">{t("title")}</h2>

      {(state === "no-config" || state === "no-key") && (
        <p className="text-destructive">{t("guideSettings")}</p>
      )}

      <label className="flex flex-col gap-1">
        {t("userInstruction")}
        <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!canStart} onClick={handleStart}>
          {t("start")}
        </Button>
        <Button variant="outline" disabled={status !== "streaming"} onClick={stop}>
          {t("stop")}
        </Button>
        {error && (
          <Button variant="outline" disabled={state !== "ready"} onClick={handleRetry}>
            {t("retry")}
          </Button>
        )}
      </div>

      <div className="text-xs opacity-70">
        {t(`status${status.charAt(0).toUpperCase()}${status.slice(1)}`)} ·{" "}
        {t("progress", { chars })}
      </div>

      {error && (
        <p className="text-destructive text-xs">
          {t("errorLabel")}: {error.code} — {error.message}
        </p>
      )}
      {showStoppedHint && <p className="text-xs opacity-70">{t("stoppedHint")}</p>}
    </div>
  );
}

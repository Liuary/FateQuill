/**
 * 内联二次确认（stage-08 T4）
 *
 * 职责：为危险动作（采纳/替换）提供**内联**确认（避免 `window.confirm` 依赖，便于 jsdom 测试）：
 * 展示后果提示 + 「确认 / 取消」。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface ConfirmInlineProps {
  /** 后果提示文案（明示影响） */
  prompt: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 内联二次确认 */
export function ConfirmInline({
  prompt,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmInlineProps) {
  const { t } = useTranslation("exploration");
  return (
    <div data-testid="confirm-inline" className="flex flex-wrap items-center gap-2">
      <span className="text-xs">{prompt}</span>
      <Button variant="outline" onClick={onConfirm}>
        {confirmLabel ?? t("confirm")}
      </Button>
      <Button variant="outline" onClick={onCancel}>
        {cancelLabel ?? t("cancel")}
      </Button>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/store/editorStore";

/** 保存状态指示（已保存 / 保存中 / 未保存 / 错误） */
export function EditorStatusBadge() {
  const { t } = useTranslation("editor");
  const saveStatus = useEditorStore((s) => s.saveStatus);
  return <span className="text-xs opacity-70">{t(saveStatus)}</span>;
}

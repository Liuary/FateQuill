import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** 中英语言切换器 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const toggle = () => {
    const next = i18n.resolvedLanguage === "en" ? "zh-CN" : "en";
    void i18n.changeLanguage(next);
    document.documentElement.lang = next;
  };
  return (
    <Button variant="outline" size="sm" onClick={toggle}>
      {i18n.resolvedLanguage === "en" ? "中文" : "EN"}
    </Button>
  );
}

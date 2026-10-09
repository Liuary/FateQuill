import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhCommon from "@/locales/zh-CN/common.json";
import enCommon from "@/locales/en/common.json";
import zhEditor from "@/locales/zh-CN/editor.json";
import enEditor from "@/locales/en/editor.json";
import zhSettings from "@/locales/zh-CN/settings.json";
import enSettings from "@/locales/en/settings.json";
import zhGeneration from "@/locales/zh-CN/generation.json";
import enGeneration from "@/locales/en/generation.json";
import zhSettingCards from "@/locales/zh-CN/settingCards.json";
import enSettingCards from "@/locales/en/settingCards.json";
import zhReview from "@/locales/zh-CN/review.json";
import enReview from "@/locales/en/review.json";
import zhResearch from "@/locales/zh-CN/research.json";
import enResearch from "@/locales/en/research.json";
import zhExploration from "@/locales/zh-CN/exploration.json";
import enExploration from "@/locales/en/exploration.json";
import zhIChing from "@/locales/zh-CN/iching.json";
import enIChing from "@/locales/en/iching.json";

export const DEFAULT_LANG = "zh-CN";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "zh-CN": {
        common: zhCommon,
        editor: zhEditor,
        settings: zhSettings,
        generation: zhGeneration,
        settingCards: zhSettingCards,
        review: zhReview,
        research: zhResearch,
        exploration: zhExploration,
        iching: zhIChing,
      },
      en: {
        common: enCommon,
        editor: enEditor,
        settings: enSettings,
        generation: enGeneration,
        settingCards: enSettingCards,
        review: enReview,
        research: enResearch,
        exploration: enExploration,
        iching: enIChing,
      },
    },
    fallbackLng: DEFAULT_LANG, // 英文缺失回退中文
    supportedLngs: ["zh-CN", "en"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "fatequill.lang",
      caches: ["localStorage"],
    },
  });

// 初始加载即同步 <html lang>，避免首帧语言属性与实际语言不一致（REV-014③）
if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LANG;
}

export default i18n;

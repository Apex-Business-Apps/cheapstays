import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fil from "./locales/fil.json";
import zh from "./locales/zh.json";
import ms from "./locales/ms.json";
import id from "./locales/id.json";
import ko from "./locales/ko.json";
import vi from "./locales/vi.json";
import ja from "./locales/ja.json";
import th from "./locales/th.json";

const STORAGE_KEY = "cs-lang";
const SUPPORTED = ["en", "fil", "zh", "ms", "id", "ko", "vi", "ja", "th"];

function detectLang(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;
  const browser = navigator.language.split("-")[0];
  if (SUPPORTED.includes(browser)) return browser;
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fil: { translation: fil },
    zh: { translation: zh },
    ms: { translation: ms },
    id: { translation: id },
    ko: { translation: ko },
    vi: { translation: vi },
    ja: { translation: ja },
    th: { translation: th },
  },
  lng: detectLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLang(code: string) {
  i18n.changeLanguage(code);
  localStorage.setItem(STORAGE_KEY, code);
}

// Expose for E2E test introspection only — harmless in production
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__cheapstays_i18n__ = i18n;
}

export default i18n;

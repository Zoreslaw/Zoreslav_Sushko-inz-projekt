import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/localization/locales/en.json";
import pl from "@/localization/locales/pl.json";
import "intl-pluralrules";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: en,
    },
    pl: {
      translation: pl,
    },
  },
  fallbackLng: "en", // fallback to English if translation is missing
  interpolation: {
    escapeValue: false, // React handles XSS
  },
});

export default i18n;

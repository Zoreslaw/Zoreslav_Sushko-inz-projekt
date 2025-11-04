import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLocales } from "expo-localization";
import i18n from "@/localization/i18n";

const LANGUAGE_KEY = "appLanguage";

export enum APP_LANGUAGES {
  EN = "en",
  PL = "pl",
}

export const useAppLanguage = () => {
  const [currentLanguage, setCurrentLanguage] = useState<APP_LANGUAGES>(APP_LANGUAGES.EN);
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        console.info("Initializing language");
        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (storedLanguage) {
          setLanguage(storedLanguage as APP_LANGUAGES);
          console.info("Language initialized", { language: storedLanguage });
        } else {
          console.info("No language found, using device language");
          const deviceLanguage = getLocales()[0]?.languageCode || "en";
          changeLanguage(deviceLanguage as APP_LANGUAGES);
        }
      } catch (error) {
        console.error("Failed to load language from storage", error);
      }
      finally {
        setLanguageLoaded(true);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = async (newLanguage: APP_LANGUAGES) => {
    try {
      await i18n.changeLanguage(newLanguage);
      setCurrentLanguage(newLanguage);
    } catch (error) {
      console.error("Failed to save language", error);
    }
  };

  const changeLanguage = async (newLanguage: APP_LANGUAGES) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, newLanguage);
      await setLanguage(newLanguage);
      console.info("Language saved to storage and changed", { language: newLanguage });
    } catch (error) {
      console.error("Failed to save language to storage and change", error);
    }
  };

  return {
    currentLanguage,
    changeLanguage,
    languageLoaded,
  };
}


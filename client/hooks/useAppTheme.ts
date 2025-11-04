import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { useEffect, useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";

export enum APP_THEMES {
  LIGHT = "light",
  DARK = "dark",
  DEVICE = "device",
}

const APP_THEME_KEY = `app_theme`;

export default function useAppTheme() {
  const [theme, setTheme] = useState<APP_THEMES>(APP_THEMES.DARK);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const backgroundColor = useThemeColor({}, "background");

  useEffect(() => {
    const initializeTheme = async () => {
      try {
        console.info("Initializing theme");
        const savedTheme = await loadThemeFromStorage();
        // setTheme(savedTheme);
        setTheme(APP_THEMES.DARK);
        setThemeLoaded(true);
        console.info("Theme initialized", { theme: savedTheme });
      } catch (error) {
        console.error("Error initializing theme", error);
      }
    };
    initializeTheme();
  }, []);

  useEffect(() => {
    const updateTheme = async () => {
      try {
        console.info("Updating theme", { theme });
        await setAppearanceColorScheme(theme);
        await saveThemeToStorage(theme);
        await setNavigationColor(backgroundColor);
        console.info("Theme updated", { theme });
      } catch (error) {
        console.error("Error updating theme", error);
      }
    };

    updateTheme();
  }, [theme]);

  return {
    themeLoaded,
    theme,
    setTheme,
  };
}

const setAppearanceColorScheme = async (theme: APP_THEMES) => {
  try {
    if (theme === APP_THEMES.DARK || theme === APP_THEMES.LIGHT) {
      Appearance.setColorScheme(theme);
      console.info("Set Appearance color scheme", { colorScheme: theme });
    } else {
      Appearance.setColorScheme(null); // If theme is "device", set it to null
      console.info("Resetting Appearance color scheme to device default");
    }
  } catch (error) {
    console.error("Error setting Appearance color scheme", error);
  }
};

const saveThemeToStorage = async (theme: APP_THEMES): Promise<void> => {
  try {
    await AsyncStorage.setItem(APP_THEME_KEY, theme);
    console.info("Theme saved to storage", { theme });
  } catch (error) {
    console.error("Failed to save theme", error);
  }
};

const loadThemeFromStorage = async (): Promise<APP_THEMES> => {
  try {
    const storedTheme = (await AsyncStorage.getItem(
      APP_THEME_KEY,
    )) as APP_THEMES;
    if (storedTheme) {
      console.info("Loaded theme from storage", { theme: storedTheme });
      return storedTheme;
    } else {
      console.info("No theme found in storage, using default", {
        defaultTheme: APP_THEMES.LIGHT,
      });
      return APP_THEMES.LIGHT;
    }
  } catch (error) {
    console.error("Failed to load theme", error);
    return APP_THEMES.DARK;
  }
};

const setNavigationColor = async (backgroundColor: string): Promise<void> => {
  try {
    if (Platform.OS === "android") {
      await NavigationBar.setVisibilityAsync("hidden");
      await NavigationBar.setBehaviorAsync("overlay-swipe");
      await NavigationBar.setBackgroundColorAsync(backgroundColor);
      console.info("Navigation bar color set", { backgroundColor });
    }
  } catch (error) {
    console.error("Error setting navigation bar color", error);
  }
};

import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppState, AppStateStatus } from "react-native";

import { AuthProvider } from "@/contexts/AuthContext";
import useAppTheme from "@/hooks/useAppTheme";
import { useAppLanguage } from "@/hooks/useAppLanguage";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appState, setAppState] = useState(AppState.currentState);
  const { themeLoaded } = useAppTheme();
  const { languageLoaded } = useAppLanguage();
  const [isReady, setIsReady] = useState(false);

  // Initialization
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Hide Splash Screen when ready
        if (themeLoaded && languageLoaded) {
          await SplashScreen.hideAsync();
          setIsReady(true);
        }
      } catch (error) {
        console.error(error);
      }
    };

    initializeApp();
  }, [themeLoaded, languageLoaded]);

  // App State
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [appState]);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(authentication)" />
            <Stack.Screen name="(swipe)" />
            <Stack.Screen name="+not-found" />
          </Stack>

          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
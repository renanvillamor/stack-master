import { useSessionStore } from "@/store/sessionStore";
import { lightTheme } from "@/theme";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider, ThemeProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-url-polyfill/auto";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Resumes a previously-active host/guest session sync connection after an app restart.
  useEffect(() => {
    useSessionStore.getState().rehydrateConnection();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Bottom sheets mount at BottomSheetModalProvider's host, outside
            PaperProvider, so they'd fall back to Paper's default (purple)
            theme. ThemeProvider supplies just the theme up here; PaperProvider
            stays inside so its Portal host keeps the existing sheet/dialog
            stacking order. */}
        <ThemeProvider theme={lightTheme}>
          <BottomSheetModalProvider>
            <PaperProvider theme={lightTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
              </Stack>
            </PaperProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

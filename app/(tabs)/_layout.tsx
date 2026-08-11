import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconProps = { color: string; size: number; focused: boolean };

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const BASE_TAB_HEIGHT = 56;
  const paddingBottom = insets.bottom + (Platform.OS === "ios" ? 4 : 8);
  const tabBarHeight = BASE_TAB_HEIGHT + insets.bottom;

  const screenOptions = {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
    tabBarStyle: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.outlineVariant,
      borderTopWidth: 1,
      height: tabBarHeight,
      paddingBottom,
      paddingTop: 8,
      elevation: 8,
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: "600" as const,
      marginTop: 2,
    },
  };

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Court",
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <MaterialCommunityIcons
              name={focused ? "pause-box" : "pause-box-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stack"
        options={{
          title: "Stack",
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <MaterialCommunityIcons
              name={focused ? "layers" : "layers-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: "Players",
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <MaterialCommunityIcons
              name={focused ? "account-group" : "account-group-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <MaterialCommunityIcons
              name={focused ? "cog" : "cog-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

import { MD3LightTheme } from "react-native-paper";

// ─── Green Palette ──────────────────────────────────────────────────────────
// Primary:   #2D6A4F  (forest green)
// Secondary: #52B788  (mint green)

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#2D6A4F",
    onPrimary: "#FFFFFF",
    primaryContainer: "#B7DFCA",
    onPrimaryContainer: "#002114",
    secondary: "#52B788",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#D8F3E3",
    onSecondaryContainer: "#0A3D22",
    background: "#F4FCF5",
    onBackground: "#1A1C1A",
    surface: "#FFFFFF",
    onSurface: "#1A1C1A",
    surfaceVariant: "#DCE5DC",
    onSurfaceVariant: "#414941",
    outline: "#717971",
    outlineVariant: "#C1CAC1",
    error: "#BA1A1A",
    onError: "#FFFFFF",
    errorContainer: "#FFDAD6",
    onErrorContainer: "#410002",
  },
};

export type AppTheme = typeof lightTheme;

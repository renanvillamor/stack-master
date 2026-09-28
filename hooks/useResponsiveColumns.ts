import { useSettingsStore } from "@/store/settingsStore";
import { useWindowDimensions } from "react-native";

/**
 * Android's own `sw600dp` resource-qualifier threshold for "tablet" — using
 * the shorter of width/height keeps the small-device check stable across
 * rotation, unlike comparing raw landscape width alone.
 */
const SMALL_DEVICE_MAX_SHORT_SIDE = 600;

/** True on phone-sized devices (short side < 600dp), regardless of orientation. */
export function useIsSmallDevice(): boolean {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) < SMALL_DEVICE_MAX_SHORT_SIDE;
}

/**
 * Landscape grid column count for Court/Player/single-group-Stack screens
 * (and any other card grid that truncates below full width), from Settings'
 * `landscapeColumns` (1-3) — but forced to 1 on phone-sized devices
 * regardless of that setting, since 2-3 columns truncates card content on a
 * phone's narrower landscape width. Only devices with a short side >= 600dp
 * (tablets) honor the setting.
 */
export function useResponsiveColumns(): number {
  const { landscapeColumns } = useSettingsStore();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallDevice = useIsSmallDevice();
  return isLandscape && !isSmallDevice ? landscapeColumns : 1;
}

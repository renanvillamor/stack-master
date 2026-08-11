import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface SettingsState {
  shufflePlayers: boolean;
  toggleShufflePlayers: () => void;
  autoStackPlayers: boolean;
  toggleAutoStackPlayers: () => void;
  landscapeColumns: 1 | 2 | 3;
  setLandscapeColumns: (value: 1 | 2 | 3) => void;
  multiGroupStack: boolean;
  toggleMultiGroupStack: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      shufflePlayers: true,

      toggleShufflePlayers: () =>
        set((state) => {
          state.shufflePlayers = !state.shufflePlayers;
        }),

      autoStackPlayers: true,

      toggleAutoStackPlayers: () =>
        set((state) => {
          state.autoStackPlayers = !state.autoStackPlayers;
        }),

      landscapeColumns: 2,

      setLandscapeColumns: (value: 1 | 2 | 3) =>
        set((state) => {
          state.landscapeColumns = value;
        }),

      multiGroupStack: true,

      toggleMultiGroupStack: () =>
        set((state) => {
          state.multiGroupStack = !state.multiGroupStack;
        }),
    })),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

import { AnnouncerVoice } from "@/types";
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
  /** Speak match call-outs aloud (StackCard announce button + auto-announce on court assignment). */
  matchAnnouncer: boolean;
  toggleMatchAnnouncer: () => void;
  /** null = the phone's default voice. Label is kept so Settings can show it without querying the engine. */
  announcerVoice: Pick<AnnouncerVoice, "id" | "label"> | null;
  setAnnouncerVoice: (
    voice: Pick<AnnouncerVoice, "id" | "label"> | null,
  ) => void;
  /** expo-speech rate; 1.0 = engine normal. */
  announcerRate: number;
  setAnnouncerRate: (rate: number) => void;
  /** expo-speech pitch; 1.0 = engine normal. */
  announcerPitch: number;
  setAnnouncerPitch: (pitch: number) => void;
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

      matchAnnouncer: false,

      toggleMatchAnnouncer: () =>
        set((state) => {
          state.matchAnnouncer = !state.matchAnnouncer;
        }),

      announcerVoice: null,

      setAnnouncerVoice: (voice) =>
        set((state) => {
          state.announcerVoice = voice;
        }),

      announcerRate: 0.9,

      setAnnouncerRate: (rate) =>
        set((state) => {
          state.announcerRate = rate;
        }),

      announcerPitch: 1.0,

      setAnnouncerPitch: (pitch) =>
        set((state) => {
          state.announcerPitch = pitch;
        }),
    })),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

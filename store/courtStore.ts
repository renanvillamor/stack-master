import { Court } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

interface CourtState {
  courts: Court[];
  addCourt: (name: string) => void;
  editCourt: (id: string, name: string) => void;
  removeCourt: (id: string) => void;
  clearAll: () => void;
}

export const useCourtStore = create<CourtState>()(
  persist(
    immer((set) => ({
      courts: [],

      addCourt: (name) =>
        set((state) => {
          state.courts.push({ id: uid(), name });
        }),

      editCourt: (id, name) =>
        set((state) => {
          const court = state.courts.find((c) => c.id === id);
          if (court) court.name = name;
        }),

      removeCourt: (id) =>
        set((state) => {
          state.courts = state.courts.filter((c) => c.id !== id);
        }),

      clearAll: () =>
        set((state) => {
          state.courts = [];
        }),
    })),
    {
      name: "court-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

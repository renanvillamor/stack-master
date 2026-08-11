import { PlayerRating, TeamMember } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

interface TeamState {
  teamName: string;
  members: TeamMember[];
  setTeamName: (name: string) => void;
  addMember: (name: string, rating: PlayerRating) => void;
  editMember: (id: string, name: string, rating: PlayerRating) => void;
  removeMember: (id: string) => void;
  toggleMemberActive: (id: string) => void;
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set) => ({
      teamName: "My Team",
      members: [],

      setTeamName: (name) =>
        set((state) => {
          state.teamName = name;
        }),

      addMember: (name, rating) =>
        set((state) => {
          state.members.push({ id: uid(), name, rating, active: true });
        }),

      editMember: (id, name, rating) =>
        set((state) => {
          const member = state.members.find((m) => m.id === id);
          if (member) {
            member.name = name;
            member.rating = rating;
          }
        }),

      removeMember: (id) =>
        set((state) => {
          state.members = state.members.filter((m) => m.id !== id);
        }),

      toggleMemberActive: (id) =>
        set((state) => {
          const member = state.members.find((m) => m.id === id);
          if (member) member.active = !member.active;
        }),
    })),
    {
      name: "team-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

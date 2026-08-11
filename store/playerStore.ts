import { MatchResult, Player, PlayerRating, PlayerStatus } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

interface PlayerState {
  players: Player[];
  addPlayer: (name: string, rating: PlayerRating) => void;
  editPlayer: (id: string, name: string, rating: PlayerRating) => void;
  removePlayer: (id: string) => void;
  updatePlayerStatus: (id: string, status: PlayerStatus) => void;
  recordGameResult: (
    id: string,
    result: MatchResult,
    teammateIds: string[],
    opponentIds: string[],
  ) => void;
  /** Locks two players together for the session, breaking either one's existing pairing first. */
  lockPlayers: (idA: string, idB: string) => void;
  /** Unlocks the given player and their partner (if any). */
  unlockPlayer: (id: string) => void;
  clearAll: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    immer((set) => ({
      players: [],

      addPlayer: (name, rating) =>
        set((state) => {
          state.players.push({
            id: uid(),
            name,
            rating,
            status: "Available",
            matches: 0,
            lastPlayed: null,
            history: [],
            lockedPartnerId: null,
          });
        }),

      editPlayer: (id, name, rating) =>
        set((state) => {
          const player = state.players.find((p) => p.id === id);
          if (player) {
            player.name = name;
            player.rating = rating;
          }
        }),

      removePlayer: (id) =>
        set((state) => {
          const removed = state.players.find((p) => p.id === id);
          if (removed?.lockedPartnerId) {
            const partner = state.players.find(
              (p) => p.id === removed.lockedPartnerId,
            );
            if (partner) partner.lockedPartnerId = null;
          }
          state.players = state.players.filter((p) => p.id !== id);
        }),

      updatePlayerStatus: (id, status) =>
        set((state) => {
          const player = state.players.find((p) => p.id === id);
          if (player) player.status = status;
        }),

      recordGameResult: (id, result, teammateIds, opponentIds) =>
        set((state) => {
          const player = state.players.find((p) => p.id === id);
          if (player) {
            player.matches += 1;
            player.lastPlayed = new Date().toISOString();
            player.history.push({
              date: new Date().toISOString(),
              result,
              teammateIds,
              opponentIds,
            });
          }
        }),

      lockPlayers: (idA, idB) =>
        set((state) => {
          if (idA === idB) return;
          const a = state.players.find((p) => p.id === idA);
          const b = state.players.find((p) => p.id === idB);
          if (!a || !b) return;

          // Break either player's existing pairing first.
          if (a.lockedPartnerId) {
            const prevPartner = state.players.find(
              (p) => p.id === a.lockedPartnerId,
            );
            if (prevPartner) prevPartner.lockedPartnerId = null;
          }
          if (b.lockedPartnerId) {
            const prevPartner = state.players.find(
              (p) => p.id === b.lockedPartnerId,
            );
            if (prevPartner) prevPartner.lockedPartnerId = null;
          }

          a.lockedPartnerId = idB;
          b.lockedPartnerId = idA;
        }),

      unlockPlayer: (id) =>
        set((state) => {
          const player = state.players.find((p) => p.id === id);
          if (!player?.lockedPartnerId) return;
          const partner = state.players.find(
            (p) => p.id === player.lockedPartnerId,
          );
          if (partner) partner.lockedPartnerId = null;
          player.lockedPartnerId = null;
        }),

      clearAll: () =>
        set((state) => {
          state.players = [];
        }),
    })),
    {
      name: "player-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

import { Quorum } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

interface QuorumState {
  quorums: Quorum[];
  /** Creates a quorum for exactly these player ids, optionally already anchored to a stack. Returns the new quorum's id. */
  createQuorum: (playerIds: string[], stackId?: string | null) => string;
  /** Dissolves a quorum outright. */
  removeQuorum: (quorumId: string) => void;
  /** Dissolves whichever quorum is anchored to this stack, if any. */
  removeQuorumForStack: (stackId: string) => void;
  /** Dissolves whichever quorum this player belongs to, if any. */
  removeQuorumForPlayer: (playerId: string) => void;
  /** Anchors (or un-anchors, when stackId is null) a quorum to the stack currently holding all 4 members. */
  setQuorumStack: (quorumId: string, stackId: string | null) => void;
  getQuorumForPlayer: (playerId: string) => Quorum | undefined;
  getQuorumForStack: (stackId: string) => Quorum | undefined;
  clearAll: () => void;
}

export const useQuorumStore = create<QuorumState>()(
  persist(
    immer((set, get) => ({
      quorums: [],

      createQuorum: (playerIds, stackId = null) => {
        const id = uid();
        set((state) => {
          state.quorums.push({
            id,
            playerIds,
            stackId,
            createdAt: new Date().toISOString(),
          });
        });
        return id;
      },

      removeQuorum: (quorumId) =>
        set((state) => {
          state.quorums = state.quorums.filter((q) => q.id !== quorumId);
        }),

      removeQuorumForStack: (stackId) =>
        set((state) => {
          state.quorums = state.quorums.filter((q) => q.stackId !== stackId);
        }),

      removeQuorumForPlayer: (playerId) =>
        set((state) => {
          state.quorums = state.quorums.filter(
            (q) => !q.playerIds.includes(playerId),
          );
        }),

      setQuorumStack: (quorumId, stackId) =>
        set((state) => {
          const quorum = state.quorums.find((q) => q.id === quorumId);
          if (quorum) quorum.stackId = stackId;
        }),

      getQuorumForPlayer: (playerId) =>
        get().quorums.find((q) => q.playerIds.includes(playerId)),

      getQuorumForStack: (stackId) =>
        get().quorums.find((q) => q.stackId === stackId),

      clearAll: () =>
        set((state) => {
          state.quorums = [];
        }),
    })),
    {
      name: "quorum-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

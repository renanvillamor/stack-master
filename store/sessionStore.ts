import { GuestPresence, SessionRole, SessionSnapshot } from "@/types";
import { generateHostKey, generateSessionCode } from "@/utils/sessionCode";
import {
  createSessionRow,
  fetchSessionSnapshot,
  startGuestSync,
  startHostSync,
  stopGuestSync,
  stopHostSync,
} from "@/utils/sessionSync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const MAX_CODE_ATTEMPTS = 5;

interface SessionState {
  role: SessionRole;
  sessionId: string | null;
  hostKey: string | null;
  /** Generated once per device, used as the realtime presence key when joining as a guest. */
  guestId: string;
  guestName: string | null;
  connectionStatus: "idle" | "connecting" | "connected" | "error";
  /** Host-only: guests currently watching, from realtime presence. */
  guestsPresent: GuestPresence[];
  /** Guest-only: the latest snapshot pushed by the host. */
  remoteSnapshot: SessionSnapshot | null;
  /** Guest-only: set when the host ends the session, so the UI can notify before leaving. */
  sessionEnded: boolean;

  startHosting: () => Promise<void>;
  stopHosting: () => Promise<void>;
  joinSession: (code: string, name: string) => Promise<boolean>;
  leaveSession: () => void;
  /** Re-opens the realtime connection for a role/session restored from persisted storage (app relaunch). */
  rehydrateConnection: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    immer((set, get) => ({
      role: null,
      sessionId: null,
      hostKey: null,
      guestId: uid(),
      guestName: null,
      connectionStatus: "idle",
      guestsPresent: [],
      remoteSnapshot: null,
      sessionEnded: false,

      startHosting: async () => {
        set((state) => {
          state.connectionStatus = "connecting";
        });
        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
          const code = generateSessionCode();
          const hostKey = generateHostKey();
          try {
            await createSessionRow(code, hostKey);
            set((state) => {
              state.role = "host";
              state.sessionId = code;
              state.hostKey = hostKey;
              state.connectionStatus = "connected";
              state.guestsPresent = [];
            });
            startHostSync(code, hostKey, (guests) =>
              set((state) => {
                state.guestsPresent = guests;
              }),
            );
            return;
          } catch (err) {
            lastError = err;
          }
        }
        set((state) => {
          state.connectionStatus = "error";
        });
        throw lastError;
      },

      stopHosting: async () => {
        const { sessionId, hostKey } = get();
        if (sessionId && hostKey) {
          await stopHostSync(sessionId, hostKey).catch((err) =>
            console.warn("Failed to end session cleanly", err),
          );
        }
        set((state) => {
          state.role = null;
          state.sessionId = null;
          state.hostKey = null;
          state.connectionStatus = "idle";
          state.guestsPresent = [];
        });
      },

      joinSession: async (code, name) => {
        set((state) => {
          state.connectionStatus = "connecting";
        });
        const snapshot = await fetchSessionSnapshot(code);
        if (!snapshot) {
          set((state) => {
            state.connectionStatus = "error";
          });
          return false;
        }
        const { guestId } = get();
        set((state) => {
          state.role = "guest";
          state.sessionId = code;
          state.guestName = name;
          state.remoteSnapshot = snapshot;
          state.connectionStatus = "connected";
          state.sessionEnded = false;
        });
        startGuestSync(
          code,
          guestId,
          name,
          (nextSnapshot) =>
            set((state) => {
              state.remoteSnapshot = nextSnapshot;
            }),
          () =>
            set((state) => {
              state.sessionEnded = true;
            }),
        );
        return true;
      },

      leaveSession: () => {
        stopGuestSync();
        set((state) => {
          state.role = null;
          state.sessionId = null;
          state.remoteSnapshot = null;
          state.connectionStatus = "idle";
          state.sessionEnded = false;
        });
      },

      rehydrateConnection: () => {
        const { role, sessionId, hostKey, guestId, guestName } = get();
        if (role === "host" && sessionId && hostKey) {
          startHostSync(sessionId, hostKey, (guests) =>
            set((state) => {
              state.guestsPresent = guests;
            }),
          );
          set((state) => {
            state.connectionStatus = "connected";
          });
        } else if (role === "guest" && sessionId && guestName) {
          fetchSessionSnapshot(sessionId).then((snapshot) => {
            if (!snapshot) {
              set((state) => {
                state.sessionEnded = true;
              });
              return;
            }
            set((state) => {
              state.remoteSnapshot = snapshot;
              state.connectionStatus = "connected";
            });
            startGuestSync(
              sessionId,
              guestId,
              guestName,
              (nextSnapshot) =>
                set((state) => {
                  state.remoteSnapshot = nextSnapshot;
                }),
              () =>
                set((state) => {
                  state.sessionEnded = true;
                }),
            );
          });
        }
      },
    })),
    {
      name: "session-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        role: state.role,
        sessionId: state.sessionId,
        hostKey: state.hostKey,
        guestId: state.guestId,
        guestName: state.guestName,
      }),
    },
  ),
);

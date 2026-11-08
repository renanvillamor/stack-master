import {
  GuestPresence,
  HostTransferResult,
  PendingHostTransfer,
  SessionRole,
  SessionSnapshot,
} from "@/types";
import { generateHostKey, generateSessionCode } from "@/utils/sessionCode";
import {
  announceHostChanged,
  applySnapshotLocally,
  beginHostTransfer,
  cancelHostTransfer,
  claimHostTransfer,
  createSessionRow,
  declineHostTransfer,
  fetchSessionSnapshot,
  startGuestSync,
  startHostSync,
  stopGuestSync,
  stopHostSync,
  stopHostSyncLocally,
} from "@/utils/sessionSync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const MAX_CODE_ATTEMPTS = 5;
/** Matches the expiry `begin_host_transfer` sets server-side. */
const TRANSFER_TTL_MS = 5 * 60 * 1000;
/** Name a former host shows up under in the guest list if it never joined a session itself. */
const FORMER_HOST_NAME = "Previous host";

const generateTransferCode = () =>
  Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

// Not serializable, like sessionSync's channel, so kept out of the store.
let transferTimer: ReturnType<typeof setTimeout> | null = null;
const clearTransferTimer = () => {
  if (transferTimer) clearTimeout(transferTimer);
  transferTimer = null;
};

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
  /** Host-only: a hand-over offered to a guest, waiting for them to enter the code. */
  pendingTransfer: PendingHostTransfer | null;
  /** Host-only: name of the guest who just declined an offer, for a one-off notice. */
  transferDeclinedBy: string | null;
  /** Guest-only: the host offered hosting to this device. */
  transferOffered: boolean;
  /** Set on a former host once another device took over and this one switched to watching. */
  handedOff: { newHostName: string | null } | null;

  startHosting: () => Promise<void>;
  stopHosting: () => Promise<void>;
  joinSession: (code: string, name: string) => Promise<boolean>;
  leaveSession: () => void;
  /** Re-opens the realtime connection for a role/session restored from persisted storage (app relaunch). */
  rehydrateConnection: () => void;
  /** Host: offers hosting to a watching guest; the code to show them lands in `pendingTransfer`. */
  offerHostTransfer: (guest: GuestPresence) => Promise<void>;
  cancelHostTransfer: () => void;
  /** Guest: turns down the host's offer. */
  declineHostTransfer: () => void;
  /** Guest: enters the host's code; on "ok" this device loads the session into its own stores and becomes the host. */
  claimHost: (code: string) => Promise<HostTransferResult>;
  dismissTransferNotice: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    immer((set, get) => {
      const connectAsHost = (sessionId: string, hostKey: string) =>
        startHostSync(sessionId, hostKey, {
          onPresenceChange: (guests) =>
            set((state) => {
              state.guestsPresent = guests;
            }),
          onHostRevoked: () => stepDownAsHost(),
          onTransferDeclined: (guestId) => {
            const pending = get().pendingTransfer;
            if (pending?.guestId !== guestId) return;
            get().cancelHostTransfer();
            set((state) => {
              state.transferDeclinedBy = pending.guestName;
            });
          },
        });

      const connectAsGuest = (sessionId: string, guestName: string) =>
        startGuestSync(sessionId, get().guestId, guestName, {
          onSnapshot: (snapshot) =>
            set((state) => {
              state.remoteSnapshot = snapshot;
            }),
          onSessionEnded: () =>
            set((state) => {
              state.sessionEnded = true;
            }),
          onTransferOffered: () =>
            set((state) => {
              state.transferOffered = true;
            }),
          onTransferCancelled: () =>
            set((state) => {
              state.transferOffered = false;
            }),
        });

      // Another device holds the host key now, so keep watching the same
      // session as a guest rather than dropping out of it.
      const stepDownAsHost = async () => {
        const { role, sessionId, guestName, pendingTransfer } = get();
        if (role !== "host" || !sessionId) return;
        clearTransferTimer();
        stopHostSyncLocally();
        const name = guestName ?? FORMER_HOST_NAME;
        set((state) => {
          state.role = "guest";
          state.hostKey = null;
          state.guestName = name;
          state.guestsPresent = [];
          state.pendingTransfer = null;
          state.handedOff = {
            newHostName: pendingTransfer?.guestName ?? null,
          };
          state.connectionStatus = "connecting";
        });
        const snapshot = await fetchSessionSnapshot(sessionId);
        if (!snapshot) {
          // The session was deleted rather than handed over.
          set((state) => {
            state.handedOff = null;
            state.sessionEnded = true;
          });
          return;
        }
        set((state) => {
          state.remoteSnapshot = snapshot;
          state.connectionStatus = "connected";
        });
        connectAsGuest(sessionId, name);
      };

      return {
        role: null,
        sessionId: null,
        hostKey: null,
        guestId: uid(),
        guestName: null,
        connectionStatus: "idle",
        guestsPresent: [],
        remoteSnapshot: null,
        sessionEnded: false,
        pendingTransfer: null,
        transferDeclinedBy: null,
        transferOffered: false,
        handedOff: null,

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
              connectAsHost(code, hostKey);
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
          clearTransferTimer();
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
            state.pendingTransfer = null;
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
          set((state) => {
            state.role = "guest";
            state.sessionId = code;
            state.guestName = name;
            state.remoteSnapshot = snapshot;
            state.connectionStatus = "connected";
            state.sessionEnded = false;
            state.transferOffered = false;
          });
          connectAsGuest(code, name);
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
            state.transferOffered = false;
            state.handedOff = null;
          });
        },

        rehydrateConnection: () => {
          const { role, sessionId, hostKey, guestName } = get();
          if (role === "host" && sessionId && hostKey) {
            // If hosting was taken over while this app was closed, the
            // initial push fails and stepDownAsHost switches it to watching.
            connectAsHost(sessionId, hostKey);
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
              connectAsGuest(sessionId, guestName);
            });
          }
        },

        offerHostTransfer: async (guest) => {
          const { sessionId, hostKey } = get();
          if (!sessionId || !hostKey) return;
          const code = generateTransferCode();
          await beginHostTransfer(sessionId, hostKey, guest.id, code);
          set((state) => {
            state.pendingTransfer = {
              guestId: guest.id,
              guestName: guest.name,
              code,
            };
          });
          clearTransferTimer();
          transferTimer = setTimeout(
            () => get().cancelHostTransfer(),
            TRANSFER_TTL_MS,
          );
        },

        cancelHostTransfer: () => {
          const { sessionId, hostKey, pendingTransfer } = get();
          clearTransferTimer();
          if (!pendingTransfer) return;
          set((state) => {
            state.pendingTransfer = null;
          });
          if (sessionId && hostKey) {
            cancelHostTransfer(
              sessionId,
              hostKey,
              pendingTransfer.guestId,
            ).catch((err) =>
              console.warn("Failed to cancel host transfer", err),
            );
          }
        },

        declineHostTransfer: () => {
          declineHostTransfer(get().guestId);
          set((state) => {
            state.transferOffered = false;
          });
        },

        claimHost: async (code) => {
          const { sessionId, guestId, remoteSnapshot } = get();
          if (!sessionId) return "error";
          const newHostKey = generateHostKey();
          const result = await claimHostTransfer(
            sessionId,
            guestId,
            code,
            newHostKey,
          );
          if (result !== "ok") return result;
          // The key swap is atomic server-side, so the old host can't store
          // anything newer than what's there now.
          const snapshot =
            (await fetchSessionSnapshot(sessionId)) ?? remoteSnapshot;
          if (snapshot) applySnapshotLocally(snapshot);
          await announceHostChanged().catch(() => {});
          set((state) => {
            state.role = "host";
            state.hostKey = newHostKey;
            state.remoteSnapshot = null;
            state.transferOffered = false;
            state.guestsPresent = [];
            state.connectionStatus = "connected";
          });
          connectAsHost(sessionId, newHostKey);
          return "ok";
        },

        dismissTransferNotice: () =>
          set((state) => {
            state.transferDeclinedBy = null;
            state.handedOff = null;
          }),
      };
    }),
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

import { supabase } from "@/lib/supabase";
import { useCourtStore } from "@/store/courtStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQuorumStore } from "@/store/quorumStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import {
  GuestPresence,
  HostTransferResult,
  SessionSnapshot,
} from "@/types";
import { RealtimeChannel } from "@supabase/supabase-js";

const PUSH_DEBOUNCE_MS = 400;

// A realtime channel and store-unsubscribe functions aren't serializable, so
// they live here as module state rather than inside sessionStore's persisted
// Zustand state.
let channel: RealtimeChannel | null = null;
let storeUnsubscribers: (() => void)[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function buildSnapshot(): SessionSnapshot {
  return {
    courts: useCourtStore.getState().courts,
    stacks: useStackStore.getState().stacks,
    players: usePlayerStore.getState().players,
    pinnedStackId: useStackStore.getState().pinnedStackId,
    quorums: useQuorumStore.getState().quorums,
    multiGroupStack: useSettingsStore.getState().multiGroupStack,
  };
}

/** The inverse of buildSnapshot: loads a host's snapshot into this device's own stores, so it can take over hosting. */
export function applySnapshotLocally(snapshot: SessionSnapshot) {
  useCourtStore.getState().replaceAll(snapshot.courts);
  usePlayerStore.getState().replaceAll(snapshot.players);
  useStackStore
    .getState()
    .replaceAll(snapshot.stacks, snapshot.pinnedStackId);
  useQuorumStore.getState().replaceAll(snapshot.quorums);
  useSettingsStore.getState().setMultiGroupStack(snapshot.multiGroupStack);
}

/** The RPCs raise this when host_key doesn't match — i.e. this device is no longer the host (or the session is gone). */
function isUnauthorized(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    String((err as { message: unknown }).message).includes("unauthorized")
  );
}

export async function createSessionRow(sessionId: string, hostKey: string) {
  const { error } = await supabase.rpc("create_session", {
    p_id: sessionId,
    p_host_key: hostKey,
  });
  if (error) throw error;
}

export async function updateSessionState(
  sessionId: string,
  hostKey: string,
  state: SessionSnapshot,
) {
  const { error } = await supabase.rpc("update_session_state", {
    p_id: sessionId,
    p_host_key: hostKey,
    p_state: state,
  });
  if (error) throw error;
}

export async function endSessionRow(sessionId: string, hostKey: string) {
  const { error } = await supabase.rpc("end_session", {
    p_id: sessionId,
    p_host_key: hostKey,
  });
  if (error) throw error;
}

export async function fetchSessionSnapshot(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("state")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return data.state as SessionSnapshot;
}

export interface HostSyncHandlers {
  onPresenceChange: (guests: GuestPresence[]) => void;
  /** This device's host_key stopped working — another device took over hosting (or the session was deleted). */
  onHostRevoked: () => void;
  onTransferDeclined: (guestId: string) => void;
}

export interface GuestSyncHandlers {
  onSnapshot: (snapshot: SessionSnapshot) => void;
  onSessionEnded: () => void;
  /** The host offered hosting to this device and is showing a code to enter. */
  onTransferOffered: () => void;
  onTransferCancelled: () => void;
}

/**
 * Writes the snapshot durably first and only broadcasts once that succeeds,
 * so a host whose key was taken over (host transfer) can never broadcast
 * stale state over the new host's — its write fails and it steps down instead.
 */
async function pushSnapshot(
  sessionId: string,
  hostKey: string,
  onHostRevoked: () => void,
) {
  const snapshot = buildSnapshot();
  try {
    await updateSessionState(sessionId, hostKey, snapshot);
  } catch (err) {
    if (isUnauthorized(err)) {
      onHostRevoked();
      return;
    }
    console.warn("Session sync push failed", err);
  }
  channel?.send({ type: "broadcast", event: "state", payload: snapshot });
}

function scheduleHostPush(
  sessionId: string,
  hostKey: string,
  onHostRevoked: () => void,
) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushSnapshot(sessionId, hostKey, onHostRevoked);
  }, PUSH_DEBOUNCE_MS);
}

function teardownChannel() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  storeUnsubscribers.forEach((unsub) => unsub());
  storeUnsubscribers = [];
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

/** Opens the session channel, pushes an initial snapshot, and re-pushes (debounced) on every relevant store change. */
export function startHostSync(
  sessionId: string,
  hostKey: string,
  { onPresenceChange, onHostRevoked, onTransferDeclined }: HostSyncHandlers,
) {
  teardownChannel();
  channel = supabase.channel(`session-${sessionId}`);

  channel
    .on("broadcast", { event: "host_changed" }, () => {
      // Anyone on the channel can broadcast this, so don't trust it — just
      // re-check our key right away; pushSnapshot steps down only if it fails.
      pushSnapshot(sessionId, hostKey, onHostRevoked);
    })
    .on("broadcast", { event: "host_transfer_declined" }, ({ payload }) => {
      onTransferDeclined((payload as { guestId: string }).guestId);
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel!.presenceState() as Record<
        string,
        GuestPresence[]
      >;
      const guests = Object.values(state)
        .flat()
        .map((p) => ({ id: p.id, name: p.name }));
      onPresenceChange(guests);
    })
    .subscribe();

  const push = () => scheduleHostPush(sessionId, hostKey, onHostRevoked);
  storeUnsubscribers = [
    useCourtStore.subscribe(push),
    useStackStore.subscribe(push),
    usePlayerStore.subscribe(push),
    useQuorumStore.subscribe(push),
    useSettingsStore.subscribe(push),
  ];
  // Push immediately so a freshly-hosted session isn't empty until the next store change.
  push();
}

export async function stopHostSync(sessionId: string, hostKey: string) {
  channel?.send({ type: "broadcast", event: "session_ended", payload: {} });
  teardownChannel();
  await endSessionRow(sessionId, hostKey);
}

/** Opens the session channel as a viewer: tracks presence and listens for state/session-ended broadcasts. */
export function startGuestSync(
  sessionId: string,
  guestId: string,
  guestName: string,
  {
    onSnapshot,
    onSessionEnded,
    onTransferOffered,
    onTransferCancelled,
  }: GuestSyncHandlers,
) {
  teardownChannel();
  channel = supabase.channel(`session-${sessionId}`, {
    config: { presence: { key: guestId } },
  });

  channel
    .on("broadcast", { event: "state" }, ({ payload }) => {
      onSnapshot(payload as SessionSnapshot);
    })
    .on("broadcast", { event: "session_ended" }, () => {
      onSessionEnded();
    })
    .on("broadcast", { event: "host_transfer_offered" }, ({ payload }) => {
      if ((payload as { guestId: string }).guestId === guestId) {
        onTransferOffered();
      }
    })
    .on("broadcast", { event: "host_transfer_cancelled" }, ({ payload }) => {
      if ((payload as { guestId: string }).guestId === guestId) {
        onTransferCancelled();
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        const presence: GuestPresence = { id: guestId, name: guestName };
        channel?.track(presence);
      }
    });
}

export function stopGuestSync() {
  teardownChannel();
}

/** Closes this device's channel without ending the session — used when a host hands the session over and switches to watching. */
export function stopHostSyncLocally() {
  teardownChannel();
}

// ─── Host transfer ──────────────────────────────────────────────────────────
// The 4-digit code is only ever sent to the server (begin/claim RPCs), never
// over the broadcast channel, which every guest can read.

/** Host: registers the code server-side, then tells that guest to start entering it. */
export async function beginHostTransfer(
  sessionId: string,
  hostKey: string,
  guestId: string,
  code: string,
) {
  const { error } = await supabase.rpc("begin_host_transfer", {
    p_id: sessionId,
    p_host_key: hostKey,
    p_guest_id: guestId,
    p_code: code,
  });
  if (error) throw error;
  channel?.send({
    type: "broadcast",
    event: "host_transfer_offered",
    payload: { guestId },
  });
}

export async function cancelHostTransfer(
  sessionId: string,
  hostKey: string,
  guestId: string,
) {
  channel?.send({
    type: "broadcast",
    event: "host_transfer_cancelled",
    payload: { guestId },
  });
  const { error } = await supabase.rpc("cancel_host_transfer", {
    p_id: sessionId,
    p_host_key: hostKey,
  });
  if (error) throw error;
}

/** Guest: turns down an offer (the host cancels it server-side when it hears this). */
export function declineHostTransfer(guestId: string) {
  channel?.send({
    type: "broadcast",
    event: "host_transfer_declined",
    payload: { guestId },
  });
}

/** Guest: on "ok" the session's host_key is now newHostKey. */
export async function claimHostTransfer(
  sessionId: string,
  guestId: string,
  code: string,
  newHostKey: string,
): Promise<HostTransferResult> {
  const { data, error } = await supabase.rpc("claim_host_transfer", {
    p_id: sessionId,
    p_guest_id: guestId,
    p_code: code,
    p_new_host_key: newHostKey,
  });
  if (error) return "error";
  return data as HostTransferResult;
}

/** New host, still on its guest channel: nudges the old host to re-check its key and step down. */
export async function announceHostChanged() {
  await channel?.send({
    type: "broadcast",
    event: "host_changed",
    payload: {},
  });
}

import { supabase } from "@/lib/supabase";
import { useCourtStore } from "@/store/courtStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQuorumStore } from "@/store/quorumStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { GuestPresence, SessionSnapshot } from "@/types";
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

function scheduleHostPush(sessionId: string, hostKey: string) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const snapshot = buildSnapshot();
    updateSessionState(sessionId, hostKey, snapshot).catch((err) =>
      console.warn("Session sync push failed", err),
    );
    channel?.send({ type: "broadcast", event: "state", payload: snapshot });
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
  onPresenceChange: (guests: GuestPresence[]) => void,
) {
  teardownChannel();
  channel = supabase.channel(`session-${sessionId}`);

  channel
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

  const push = () => scheduleHostPush(sessionId, hostKey);
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
  onSnapshot: (snapshot: SessionSnapshot) => void,
  onSessionEnded: () => void,
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

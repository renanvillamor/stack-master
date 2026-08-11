import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { PlayerRating, Stack, StackType } from "@/types";
import {
  PlayerGroupKey,
  getPlayerGroup,
  getStackGroup,
} from "@/utils/groupQueue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const isMultiGroupEnabled = () => useSettingsStore.getState().multiGroupStack;

const ratingOf = (playerId: string): PlayerRating =>
  usePlayerStore.getState().players.find((p) => p.id === playerId)?.rating ??
  "NR";

/** True when idA and idB are locked-paired with each other. */
const isLockedPair = (idA: string, idB: string): boolean =>
  usePlayerStore.getState().players.find((p) => p.id === idA)
    ?.lockedPartnerId === idB;

/** Id of the player locked-paired with `playerId`, or null. */
const partnerOf = (playerId: string): string | null =>
  usePlayerStore.getState().players.find((p) => p.id === playerId)
    ?.lockedPartnerId ?? null;

/**
 * Adds `ids` onto `stack`'s team1/team2. A locked pair with both members in
 * `ids` is seated together on whichever team has room for both; if `stack`
 * only has one free slot per team (so the pair can't share a team there),
 * they're given a fresh stack of `type` — appended to `stacks` — instead of
 * being split across `stack`'s two teams. A single member whose partner is
 * already seated in `stack` joins that partner's team. Anything left over
 * falls back to filling team1 then team2 of `stack`.
 */
function placeOnTeams(
  stacks: Stack[],
  stack: Stack,
  ids: string[],
  type: StackType,
) {
  const room1 = () => 2 - stack.team1.playerIds.length;
  const room2 = () => 2 - stack.team2.playerIds.length;
  const placed = new Set<string>();

  // Pass 1: pairs where both members are in this batch — seat together,
  // or spin off a new stack if `stack` can't hold both on one team.
  for (const id of ids) {
    if (placed.has(id)) continue;
    const partner = partnerOf(id);
    if (!partner || !ids.includes(partner) || placed.has(partner)) continue;
    if (room1() >= 2) {
      stack.team1.playerIds.push(id, partner);
    } else if (room2() >= 2) {
      stack.team2.playerIds.push(id, partner);
    } else {
      stacks.push({
        id: uid(),
        courtId: null,
        type,
        team1: { playerIds: [id, partner] },
        team2: { playerIds: [] },
        createdAt: new Date().toISOString(),
        gameStartedAt: null,
      });
    }
    placed.add(id);
    placed.add(partner);
  }

  // Pass 2: a single member whose partner is already seated in this stack.
  for (const id of ids) {
    if (placed.has(id)) continue;
    const partner = partnerOf(id);
    if (!partner) continue;
    if (stack.team1.playerIds.includes(partner) && room1() >= 1) {
      stack.team1.playerIds.push(id);
      placed.add(id);
    } else if (stack.team2.playerIds.includes(partner) && room2() >= 1) {
      stack.team2.playerIds.push(id);
      placed.add(id);
    }
  }

  // Pass 3: fallback — fill team1 then team2.
  for (const id of ids) {
    if (placed.has(id)) continue;
    if (room1() >= 1) {
      stack.team1.playerIds.push(id);
    } else if (room2() >= 1) {
      stack.team2.playerIds.push(id);
    }
    placed.add(id);
  }
}

/**
 * Seats `ids` (1 or 2 players) into `stack`. A pair prefers a single team
 * with room for both; otherwise falls back to filling team1 then team2 one
 * at a time, same as a solo move.
 */
function seatPlayersInStack(stack: Stack, ids: string[]) {
  if (ids.length === 2) {
    const room1 = 2 - stack.team1.playerIds.length;
    const room2 = 2 - stack.team2.playerIds.length;
    // Caller must guarantee one team has room for both — a pair is never
    // split across teams just because there are 2 free seats total.
    if (room1 >= 2) {
      stack.team1.playerIds.push(...ids);
    } else if (room2 >= 2) {
      stack.team2.playerIds.push(...ids);
    }
    return;
  }
  for (const id of ids) {
    if (stack.team1.playerIds.length < 2) {
      stack.team1.playerIds.push(id);
    } else if (stack.team2.playerIds.length < 2) {
      stack.team2.playerIds.push(id);
    }
  }
}

/**
 * True when `stack` has one team with room for 2 more players — the bar for
 * seating a locked pair together without splitting them across teams.
 * `excludeId`, if given and currently seated in `stack`, is treated as
 * already gone (used when the pair's destination is the partner's own
 * current stack, which is about to have the partner pulled out of it).
 */
function hasPairRoom(stack: Stack, excludeId?: string): boolean {
  const team1Len =
    excludeId && stack.team1.playerIds.includes(excludeId)
      ? stack.team1.playerIds.length - 1
      : stack.team1.playerIds.length;
  const team2Len =
    excludeId && stack.team2.playerIds.includes(excludeId)
      ? stack.team2.playerIds.length - 1
      : stack.team2.playerIds.length;
  return 2 - team1Len >= 2 || 2 - team2Len >= 2;
}

const groupOfPlayer = (playerId: string): PlayerGroupKey =>
  getPlayerGroup(ratingOf(playerId));

const groupOfStack = (stack: Stack): PlayerGroupKey | null =>
  getStackGroup(stack, ratingOf);

/** True when a queue slot with the given (possibly unset) group can accept a player of `requiredGroup`. */
const groupAllows = (
  slotGroup: PlayerGroupKey | null,
  requiredGroup: PlayerGroupKey | null,
) => !requiredGroup || slotGroup === null || slotGroup === requiredGroup;

/**
 * A locked pair (2 ids) or a single player (1 id) — the smallest unit that
 * must stay together when players are shuffled between stacks, since a pair
 * is never split across stacks.
 */
type QueueUnit = string[];

/**
 * Flattens a bucket of same-type/same-group queued stacks (in queue order)
 * into an ordered list of units: locked pairs collapse into one 2-id unit,
 * everyone else is a 1-id unit. Order follows each stack's team1-then-team2
 * seating, which is what preserves queue/wait order once units are
 * repacked.
 */
function flattenToUnits(bucketStacks: Stack[]): QueueUnit[] {
  const units: QueueUnit[] = [];
  for (const s of bucketStacks) {
    const seq = [...s.team1.playerIds, ...s.team2.playerIds];
    const consumed = new Set<string>();
    for (const id of seq) {
      if (consumed.has(id)) continue;
      const partner = partnerOf(id);
      if (partner && seq.includes(partner) && !consumed.has(partner)) {
        units.push([id, partner]);
        consumed.add(id);
        consumed.add(partner);
      } else {
        units.push([id]);
        consumed.add(id);
      }
    }
  }
  return units;
}

/**
 * Computes what "auto-fill vacant slots" would do to `stacks`: within each
 * queued-stack bucket (split by group when multi-group stacking is on, but
 * never by winners/losers/default — same as the manual "Move to Stack"
 * picker), players are packed forward in queue order — front stacks filled
 * to 4 before later ones are touched — so gaps collapse toward the back of
 * the queue instead of requiring the admin to move players one stack at a
 * time. Locked pairs always move as a unit and only ever land together on
 * one team; a pair that can't fit a team's remaining single seat is skipped
 * over (not consumed) so a single player behind it can fill that seat
 * instead, and the pair waits for a slot that fits both of them.
 *
 * When multi-group stacking is on, `restrictToGroup` limits the operation
 * to just that column's bucket (leaving the other group's stacks
 * untouched) — this is what backs the separate Beginners/Advanced auto-fill
 * buttons. Left undefined, every bucket is packed in one pass.
 *
 * Pure and side-effect free — used both to actually apply the change and to
 * check whether there's anything to do (for showing/enabling a button).
 */
function planAutoFill(
  stacks: Stack[],
  restrictToGroup?: PlayerGroupKey,
): {
  updates: Map<string, { team1: string[]; team2: string[] }>;
  removedIds: Set<string>;
  changed: boolean;
} {
  // Bucketed by group only, not by stack type — the manual "Move to Stack"
  // picker already lets the admin move a player into any queued stack
  // regardless of winners/losers/default, so auto-fill mirrors that rather
  // than being more restrictive. Group is still respected when multi-group
  // stacking is on, since crossing that boundary would visibly reshuffle
  // the beginner/advanced columns.
  const multiGroup = isMultiGroupEnabled();
  const queued = stacks.filter((s) => s.courtId === null);

  const buckets = new Map<string, Stack[]>();
  for (const s of queued) {
    const key = multiGroup ? (groupOfStack(s) ?? "unsorted") : "all";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }

  const updates = new Map<string, { team1: string[]; team2: string[] }>();
  const removedIds = new Set<string>();
  let changed = false;

  for (const [key, bucketStacks] of buckets.entries()) {
    if (restrictToGroup && key !== restrictToGroup) continue;
    if (bucketStacks.length < 2) continue;

    const queueUnits = flattenToUnits(bucketStacks);

    for (const s of bucketStacks) {
      const team1: string[] = [];
      const team2: string[] = [];
      const fill = (team: string[], capacity: number) => {
        while (team.length < capacity) {
          const idx = queueUnits.findIndex(
            (u) => u.length <= capacity - team.length,
          );
          if (idx === -1) break;
          const [unit] = queueUnits.splice(idx, 1);
          team.push(...unit);
        }
      };
      fill(team1, 2);
      fill(team2, 2);

      if (team1.length === 0 && team2.length === 0) {
        removedIds.add(s.id);
        changed = true;
        continue;
      }

      const sameAsBefore =
        team1.length === s.team1.playerIds.length &&
        team2.length === s.team2.playerIds.length &&
        team1.every((id, i) => id === s.team1.playerIds[i]) &&
        team2.every((id, i) => id === s.team2.playerIds[i]);

      if (!sameAsBefore) {
        updates.set(s.id, { team1, team2 });
        changed = true;
      }
    }
  }

  return { updates, removedIds, changed };
}

/** Adds a single player to the first available unassigned stack of the same type, or creates one. */
function addToQueue(
  stacks: Stack[],
  playerId: string,
  type: StackType = "default",
) {
  const alreadyQueued = stacks.some(
    (s) =>
      s.team1.playerIds.includes(playerId) ||
      s.team2.playerIds.includes(playerId),
  );
  if (alreadyQueued) return;

  const requiredGroup = isMultiGroupEnabled() ? groupOfPlayer(playerId) : null;
  const partnerId = partnerOf(playerId);

  const matches = (s: Stack) =>
    s.courtId === null &&
    (s.type ?? "default") === type &&
    s.team1.playerIds.length + s.team2.playerIds.length < 4 &&
    groupAllows(groupOfStack(s), requiredGroup);

  // Prefer joining the locked partner's stack, if they're already queued.
  const partnerStack = partnerId
    ? stacks.find(
        (s) =>
          matches(s) &&
          (s.team1.playerIds.includes(partnerId) ||
            s.team2.playerIds.includes(partnerId)),
      )
    : undefined;

  const openStack = partnerStack ?? stacks.find(matches);

  if (openStack) {
    placeOnTeams(stacks, openStack, [playerId], type);
  } else {
    const newStack: Stack = {
      id: uid(),
      courtId: null,
      type,
      team1: { playerIds: [] },
      team2: { playerIds: [] },
      createdAt: new Date().toISOString(),
      gameStartedAt: null,
    };
    placeOnTeams(stacks, newStack, [playerId], type);
    stacks.push(newStack);
  }
}

/**
 * Adds a batch of players to the queue, distributing them across possibly
 * several stacks. Locked pairs (both members present in `playerIds`) are
 * placed first, each claiming a whole team on an existing or new stack as
 * one atomic unit — so unrelated players in the same batch can never fill
 * the seat a partner needs before the partner is placed. Remaining singles
 * fall back to the normal one-at-a-time queueing.
 */
function addManyToQueue(
  stacks: Stack[],
  playerIds: string[],
  type: StackType = "default",
) {
  const isQueued = (id: string) =>
    stacks.some(
      (s) => s.team1.playerIds.includes(id) || s.team2.playerIds.includes(id),
    );
  const freshIds = playerIds.filter((id) => !isQueued(id));
  if (freshIds.length === 0) return;

  // Split into locked pairs (both members in this batch) and singles —
  // pairs are seated first so they always get to claim a whole team.
  const consumed = new Set<string>();
  const pairs: [string, string][] = [];
  for (const id of freshIds) {
    if (consumed.has(id)) continue;
    const partner = partnerOf(id);
    if (partner && freshIds.includes(partner) && !consumed.has(partner)) {
      pairs.push([id, partner]);
      consumed.add(id);
      consumed.add(partner);
    }
  }
  const singles = freshIds.filter((id) => !consumed.has(id));

  for (const [a, b] of pairs) {
    const requiredGroup = isMultiGroupEnabled() ? groupOfPlayer(a) : null;
    const dest = stacks.find(
      (s) =>
        s.courtId === null &&
        (s.type ?? "default") === type &&
        groupAllows(groupOfStack(s), requiredGroup) &&
        hasPairRoom(s),
    );
    if (dest) {
      placeOnTeams(stacks, dest, [a, b], type);
    } else {
      stacks.push({
        id: uid(),
        courtId: null,
        type,
        team1: { playerIds: [a, b] },
        team2: { playerIds: [] },
        createdAt: new Date().toISOString(),
        gameStartedAt: null,
      });
    }
  }

  for (const id of singles) {
    addToQueue(stacks, id, type);
  }
}

/** Places two players into a new stack of the given type on opposite teams. */
function addSplitToQueue(
  stacks: Stack[],
  id1: string,
  id2: string,
  type: StackType,
) {
  const alreadyQueued = (id: string) =>
    stacks.some(
      (s) => s.team1.playerIds.includes(id) || s.team2.playerIds.includes(id),
    );
  if (alreadyQueued(id1) && alreadyQueued(id2)) return;
  stacks.push({
    id: uid(),
    courtId: null,
    type,
    team1: { playerIds: alreadyQueued(id1) ? [] : [id1] },
    team2: { playerIds: alreadyQueued(id2) ? [] : [id2] },
    createdAt: new Date().toISOString(),
    gameStartedAt: null,
  });
}

interface StackState {
  stacks: Stack[];
  addPlayerToStack: (playerId: string) => void;
  addPlayerToWinnerStack: (playerId: string) => void;
  addPlayerToLoserStack: (playerId: string) => void;
  /**
   * Adds a batch of players to the queue, spread across as many stacks as
   * needed. Locked pairs in the batch are always seated together, even when
   * other players in the same batch are queued alongside them.
   */
  addManyPlayersToQueue: (playerIds: string[], type?: StackType) => void;
  /** Creates a new stack of the given type with playerIds filled in, keeping locked pairs on the same team. */
  addPlayersToNewStack: (playerIds: string[], type?: StackType) => void;
  /** Creates a new stack of the given type with id1 on team1 and id2 on team2. */
  addSplitPlayersToNewStack: (
    id1: string,
    id2: string,
    type?: StackType,
  ) => void;
  /**
   * Atomically finds the first open unassigned stack of the given type that
   * has room for all playerIds, and adds the players to it.  If no such stack
   * exists, a new typed stack is created.  Everything runs inside a single
   * Zustand set() so the lookup and mutation are always consistent.
   */
  addPlayersToTypeQueue: (playerIds: string[], type?: StackType) => void;
  assignCourtToStack: (stackId: string, courtId: string) => void;
  removeStack: (id: string) => Stack | undefined;
  /** Moves a player to the other team. Only call when the other team has space. */
  movePlayerBetweenTeams: (stackId: string, playerId: string) => void;
  /** Swaps playerA and playerB who are on opposite teams. */
  swapPlayersBetweenTeams: (
    stackId: string,
    playerIdA: string,
    playerIdB: string,
  ) => void;
  /**
   * Removes a single player from whichever team they are on. If they're
   * locked-paired and their partner is also queued (not on a court), the
   * partner is removed too. Returns every playerId actually removed, so the
   * caller knows who to mark Available.
   */
  removeSinglePlayerFromStack: (stackId: string, playerId: string) => string[];
  /** Unassigns the court from a stack, returning it to the queue. */
  returnStackToQueue: (stackId: string) => void;
  /** Adds a batch of players into a specific existing stack, keeping locked pairs on the same team. */
  addPlayersToSpecificStack: (stackId: string, playerIds: string[]) => void;
  /**
   * Atomically removes the game stack and re-queues winners/losers.
   * Everything runs in ONE Zustand set() so the removal and the re-queue
   * lookups share the exact same Immer draft — no stale-state issues. A
   * player locked-paired to someone in this game, but who wasn't in the
   * game themselves, is pulled in to reunite with their partner — returns
   * the ids of any such players so the caller can sync their player status.
   */
  processGameResult: (
    gameStackId: string,
    winnerIds: string[],
    loserIds: string[],
    shuffle: boolean,
  ) => string[];
  /**
   * Moves a player from one stack to another (target must have room). If the
   * player is locked-paired and the partner is queued elsewhere, the partner
   * comes along onto the same team — but only if the destination has room
   * for both there. When it doesn't, nothing is moved and this returns
   * false so the caller can tell the user there's no space.
   */
  movePlayerBetweenStacks: (fromStackId: string, playerId: string, toStackId: string) => boolean;
  /** Moves a player out of an existing stack and into a brand-new stack of the given type. */
  movePlayerToNewStack: (fromStackId: string, playerId: string, type?: StackType) => void;
  /** Swaps a player from stackA with a player from stackB, keeping their team positions. */
  swapPlayersBetweenStacks: (stackAId: string, playerAId: string, stackBId: string, playerBId: string) => void;
  /**
   * Packs players forward within the queue so gaps in early stacks are
   * filled from later ones, cascading the deficit toward the back instead
   * of requiring the admin to move players one stack at a time. When
   * multi-group stacking is on, pass "beginner" or "advanced" to restrict
   * the pack to that group's column only — omit it to pack everything
   * (the only mode there is when multi-group stacking is off). No-op if
   * the targeted segment is already packed.
   */
  autoFillQueue: (group?: PlayerGroupKey) => void;
  /** True when autoFillQueue(group) would actually change anything right now — use to show/enable its button. */
  canAutoFillQueue: (group?: PlayerGroupKey) => boolean;
  /** Clears all stacks. */
  clearAll: () => void;
  /** Id of a stack manually pinned to jump the queue, or null if none is pinned. */
  pinnedStackId: string | null;
  /**
   * Pins (or unpins, when stackId is null) a stack to be treated as next in
   * line, overriding the default queue order until it's assigned to a court
   * or removed.
   */
  setPinnedStack: (stackId: string | null) => void;
  /**
   * Suggests which queued, full stack should move to a freed court next —
   * always the oldest ready stack in queue order. A pinned stack takes
   * priority as soon as it's full.
   */
  getSuggestedNextStack: () => Stack | undefined;
  /**
   * Returns the very first stack waiting in the queue, in the same order
   * shown on the Stack screen — regardless of whether it's full yet. A
   * pinned stack always takes priority here, even if incomplete.
   */
  getNextQueuedStack: () => Stack | undefined;
}

export const useStackStore = create<StackState>()(
  persist(
    immer((set, get) => ({
      stacks: [],
      pinnedStackId: null,

      setPinnedStack: (stackId) =>
        set((state) => {
          state.pinnedStackId = stackId;
        }),

      addPlayerToStack: (playerId) =>
        set((state) => addToQueue(state.stacks, playerId, "default")),

      addPlayerToWinnerStack: (playerId) =>
        set((state) => addToQueue(state.stacks, playerId, "winners")),

      addPlayerToLoserStack: (playerId) =>
        set((state) => addToQueue(state.stacks, playerId, "losers")),

      addManyPlayersToQueue: (playerIds, type = "default") =>
        set((state) => addManyToQueue(state.stacks, playerIds, type)),

      addPlayersToNewStack: (playerIds, type = "default") =>
        set((state) => {
          const freshIds = playerIds.filter(
            (playerId) =>
              !state.stacks.some(
                (s) =>
                  s.team1.playerIds.includes(playerId) ||
                  s.team2.playerIds.includes(playerId),
              ),
          );
          const newStack: Stack = {
            id: uid(),
            courtId: null,
            type,
            team1: { playerIds: [] },
            team2: { playerIds: [] },
            createdAt: new Date().toISOString(),
            gameStartedAt: null,
          };
          placeOnTeams(state.stacks, newStack, freshIds, type);
          state.stacks.push(newStack);
        }),

      addSplitPlayersToNewStack: (id1, id2, type = "default") =>
        set((state) => addSplitToQueue(state.stacks, id1, id2, type)),

      addPlayersToTypeQueue: (playerIds, type = "default") =>
        set((state) => {
          // All logic in one set() so the lookup and mutation are atomic.
          const isQueued = (id: string) =>
            state.stacks.some(
              (s) =>
                s.team1.playerIds.includes(id) ||
                s.team2.playerIds.includes(id),
            );

          const freshIds = playerIds.filter((id) => !isQueued(id));
          if (freshIds.length === 0) return;

          const requiredGroup = isMultiGroupEnabled()
            ? groupOfPlayer(freshIds[0])
            : null;

          // Find first open unassigned stack of the matching type with enough room.
          const targetIdx = state.stacks.findIndex(
            (s) =>
              s.courtId === null &&
              (s.type ?? "default") === type &&
              4 - (s.team1.playerIds.length + s.team2.playerIds.length) >=
                freshIds.length &&
              groupAllows(groupOfStack(s), requiredGroup),
          );

          if (targetIdx !== -1) {
            // Access through the draft index so Immer correctly tracks mutations.
            const dest = state.stacks[targetIdx];
            placeOnTeams(state.stacks, dest, freshIds, type);
          } else {
            // Build the complete stack (with player IDs already filled) as a
            // plain object and push it in one step — never mutate a plain object
            // after it has been handed to the Immer draft.
            const newStack: Stack = {
              id: uid(),
              courtId: null,
              type,
              team1: { playerIds: [] },
              team2: { playerIds: [] },
              createdAt: new Date().toISOString(),
              gameStartedAt: null,
            };
            placeOnTeams(state.stacks, newStack, freshIds, type);
            state.stacks.push(newStack);
          }
        }),

      /** Sets the courtId on a stack, marking it as in-play on that court. */
      assignCourtToStack: (stackId, courtId) =>
        set((state) => {
          const stack = state.stacks.find((s) => s.id === stackId);
          if (!stack) return;
          stack.courtId = courtId;
          stack.gameStartedAt = new Date().toISOString();

          if (state.pinnedStackId === stackId) state.pinnedStackId = null;
        }),

      /** Removes a stack and returns it so callers can free players. */
      removeStack: (id) => {
        const stack = get().stacks.find((s) => s.id === id);
        set((state) => {
          state.stacks = state.stacks.filter((s) => s.id !== id);
          if (state.pinnedStackId === id) state.pinnedStackId = null;
        });
        return stack;
      },

      movePlayerBetweenTeams: (stackId, playerId) =>
        set((state) => {
          const stack = state.stacks.find((s) => s.id === stackId);
          if (!stack) return;
          if (stack.team1.playerIds.includes(playerId)) {
            stack.team1.playerIds = stack.team1.playerIds.filter(
              (id) => id !== playerId,
            );
            stack.team2.playerIds.push(playerId);
          } else {
            stack.team2.playerIds = stack.team2.playerIds.filter(
              (id) => id !== playerId,
            );
            stack.team1.playerIds.push(playerId);
          }
        }),

      swapPlayersBetweenTeams: (stackId, playerIdA, playerIdB) =>
        set((state) => {
          const stack = state.stacks.find((s) => s.id === stackId);
          if (!stack) return;
          const aInTeam1 = stack.team1.playerIds.includes(playerIdA);
          const bInTeam1 = stack.team1.playerIds.includes(playerIdB);
          if (aInTeam1 === bInTeam1) return; // already on same team
          if (aInTeam1) {
            const ai = stack.team1.playerIds.indexOf(playerIdA);
            const bi = stack.team2.playerIds.indexOf(playerIdB);
            stack.team1.playerIds[ai] = playerIdB;
            stack.team2.playerIds[bi] = playerIdA;
          } else {
            const ai = stack.team2.playerIds.indexOf(playerIdA);
            const bi = stack.team1.playerIds.indexOf(playerIdB);
            stack.team2.playerIds[ai] = playerIdB;
            stack.team1.playerIds[bi] = playerIdA;
          }
        }),

      removeSinglePlayerFromStack: (stackId, playerId) => {
        const removedIds: string[] = [];
        set((state) => {
          const stack = state.stacks.find((s) => s.id === stackId);
          if (!stack) return;

          const dropIfEmpty = (s: Stack) => {
            // An emptied stack must be deleted, not left behind — a hidden
            // empty stack would otherwise keep its original createdAt and get
            // silently picked up as the "oldest" stack once new players queue.
            if (s.team1.playerIds.length === 0 && s.team2.playerIds.length === 0) {
              state.stacks = state.stacks.filter((x) => x.id !== s.id);
              if (state.pinnedStackId === s.id) state.pinnedStackId = null;
            }
          };

          stack.team1.playerIds = stack.team1.playerIds.filter(
            (id) => id !== playerId,
          );
          stack.team2.playerIds = stack.team2.playerIds.filter(
            (id) => id !== playerId,
          );
          removedIds.push(playerId);
          dropIfEmpty(stack);

          // A locked partner queued elsewhere comes out too, so the pair
          // never ends up split between the queue and "Available".
          const partnerId = partnerOf(playerId);
          const partnerStack = partnerId
            ? state.stacks.find(
                (s) =>
                  s.courtId === null &&
                  (s.team1.playerIds.includes(partnerId) ||
                    s.team2.playerIds.includes(partnerId)),
              )
            : undefined;
          if (partnerStack && partnerId) {
            partnerStack.team1.playerIds = partnerStack.team1.playerIds.filter(
              (id) => id !== partnerId,
            );
            partnerStack.team2.playerIds = partnerStack.team2.playerIds.filter(
              (id) => id !== partnerId,
            );
            removedIds.push(partnerId);
            dropIfEmpty(partnerStack);
          }
        });
        return removedIds;
      },

      returnStackToQueue: (stackId) =>
        set((state) => {
          const stack = state.stacks.find((s) => s.id === stackId);
          if (stack) {
            stack.courtId = null;
            stack.gameStartedAt = null;
          }
        }),

      addPlayersToSpecificStack: (stackId, playerIds) =>
        set((state) => {
          const stack = state.stacks.find((s) => s.id === stackId);
          if (!stack) return;
          const freshIds = playerIds.filter(
            (playerId) =>
              !state.stacks.some(
                (s) =>
                  s.team1.playerIds.includes(playerId) ||
                  s.team2.playerIds.includes(playerId),
              ),
          );
          placeOnTeams(state.stacks, stack, freshIds, stack.type ?? "default");
        }),
      processGameResult: (gameStackId, winnerIds, loserIds, shuffle) => {
        // Ids of locked partners pulled in from elsewhere (Available or a
        // different queue stack) to reunite with an in-game partner —
        // returned so the caller can sync their player status to "Stacked".
        const pulledInIds: string[] = [];
        set((state) => {
          // Remove the game stack first — within the same draft.
          state.stacks = state.stacks.filter((s) => s.id !== gameStackId);

          /** Find or create a typed queue slot and fill it with `ids`. */
          const routeToTypedStack = (ids: string[], type: StackType) => {
            const inAnyStack = (id: string) =>
              state.stacks.some(
                (s) =>
                  s.team1.playerIds.includes(id) ||
                  s.team2.playerIds.includes(id),
              );
            const fresh = ids.filter((id) => !inAnyStack(id));
            if (fresh.length === 0) return;

            // A player locked-paired to someone in this batch, but who
            // wasn't themselves part of this game (waiting Available, or
            // queued in an unrelated stack), reunites with their partner
            // here — pulled out of wherever they're currently queued. A
            // partner mid-match on another court is left alone; they'll
            // reunite when their own game ends.
            const additions: string[] = [];
            for (const id of fresh) {
              const partner = partnerOf(id);
              if (
                !partner ||
                ids.includes(partner) ||
                fresh.includes(partner) ||
                additions.includes(partner)
              )
                continue;
              const partnerStack = state.stacks.find(
                (s) =>
                  s.team1.playerIds.includes(partner) ||
                  s.team2.playerIds.includes(partner),
              );
              if (partnerStack) {
                if (partnerStack.courtId !== null) continue;
                partnerStack.team1.playerIds =
                  partnerStack.team1.playerIds.filter((pid) => pid !== partner);
                partnerStack.team2.playerIds =
                  partnerStack.team2.playerIds.filter((pid) => pid !== partner);
                if (
                  partnerStack.team1.playerIds.length === 0 &&
                  partnerStack.team2.playerIds.length === 0
                ) {
                  state.stacks = state.stacks.filter(
                    (s) => s.id !== partnerStack.id,
                  );
                  if (state.pinnedStackId === partnerStack.id) {
                    state.pinnedStackId = null;
                  }
                }
              }
              additions.push(partner);
            }
            pulledInIds.push(...additions);
            const allFresh = [...fresh, ...additions];

            // Distribute unit-by-unit (locked pairs stay together, singles
            // go one at a time) instead of requiring one stack to fit
            // everyone at once — otherwise a stack that's short just one
            // seat gets skipped entirely and a fresh stack spun up instead
            // of topping it off.
            addManyToQueue(state.stacks, allFresh, type);
          };

          // A pair can get lock-paired mid-game while already split across
          // the winning and losing team — that lock must still reunite them.
          // They follow the loser: the pair lands together in the LOSER
          // stack, while whichever teammate each of them leaves behind on
          // their original team reunites together in the WINNER stack
          // instead. (Locks formed before the game started never hit this:
          // both members already share a team, so they land in the same
          // winnerIds/loserIds array on their own.)
          const crossWinnerIds = winnerIds.filter((id) => {
            const partner = partnerOf(id);
            return !!partner && loserIds.includes(partner);
          });
          const crossLoserIds = crossWinnerIds.map((id) => partnerOf(id)!);
          const winners = winnerIds.filter((id) => !crossWinnerIds.includes(id));
          const losers = loserIds.filter((id) => !crossLoserIds.includes(id));

          if (crossWinnerIds.length > 0) {
            routeToTypedStack([...crossWinnerIds, ...crossLoserIds], "losers");
            routeToTypedStack([...winners, ...losers], "winners");
          } else if (shuffle) {
            // Split: id1 → team1, id2 → team2. Find an existing typed stack
            // that has a free slot on BOTH teams, otherwise create a new one.
            const routeToTypedStackSplit = (
              id1: string,
              id2: string,
              type: StackType,
            ) => {
              const inAnyStack = (id: string) =>
                state.stacks.some(
                  (s) =>
                    s.team1.playerIds.includes(id) ||
                    s.team2.playerIds.includes(id),
                );
              const fresh1 = !inAnyStack(id1);
              const fresh2 = !inAnyStack(id2);
              if (!fresh1 && !fresh2) return;

              const requiredGroup = isMultiGroupEnabled()
                ? groupOfPlayer(fresh1 ? id1 : id2)
                : null;

              // Prefer a stack with room on both teams, so id1/id2 land on
              // opposite teams — keeps shuffle's "don't re-team" intent.
              const idx = state.stacks.findIndex(
                (s) =>
                  s.courtId === null &&
                  (s.type ?? "default") === type &&
                  s.team1.playerIds.length < 2 &&
                  s.team2.playerIds.length < 2 &&
                  groupAllows(groupOfStack(s), requiredGroup),
              );

              if (idx !== -1) {
                const dest = state.stacks[idx];
                if (fresh1) dest.team1.playerIds.push(id1);
                if (fresh2) dest.team2.playerIds.push(id2);
                return;
              }

              // No stack can seat both while splitting them onto opposite
              // teams — fall back to topping off any vacant slot one at a
              // time instead of leaving it empty and spinning up a fresh
              // stack for both.
              const freshIds = [
                ...(fresh1 ? [id1] : []),
                ...(fresh2 ? [id2] : []),
              ];
              addManyToQueue(state.stacks, freshIds, type);
            };
            // Locked pairs stay together as teammates regardless of shuffle.
            // Splitting requires exactly 2 on each side (cross-locked pairs
            // never reach here — they're routed above instead).
            if (winners.length === 2) {
              if (isLockedPair(winners[0], winners[1])) {
                routeToTypedStack(winners, "winners");
              } else {
                routeToTypedStackSplit(winners[0], winners[1], "winners");
              }
            } else {
              routeToTypedStack(winners, "winners");
            }
            if (losers.length === 2) {
              if (isLockedPair(losers[0], losers[1])) {
                routeToTypedStack(losers, "losers");
              } else {
                routeToTypedStackSplit(losers[0], losers[1], "losers");
              }
            } else {
              routeToTypedStack(losers, "losers");
            }
          } else {
            routeToTypedStack(winners, "winners");
            routeToTypedStack(losers, "losers");
          }
        });
        return pulledInIds;
      },

      movePlayerBetweenStacks: (fromStackId, playerId, toStackId) => {
        let moved = true;
        set((state) => {
          const from = state.stacks.find((s) => s.id === fromStackId);
          const to = state.stacks.find((s) => s.id === toStackId);
          if (!from || !to) {
            moved = false;
            return;
          }

          const dropIfEmpty = (s: Stack) => {
            // Emptied stack must be deleted, not hidden — see
            // removeSinglePlayerFromStack for why a stale empty stack is a bug.
            if (s.team1.playerIds.length === 0 && s.team2.playerIds.length === 0) {
              state.stacks = state.stacks.filter((x) => x.id !== s.id);
              if (state.pinnedStackId === s.id) state.pinnedStackId = null;
            }
          };

          // A locked partner queued elsewhere comes along onto the same
          // team. If the destination has no room for both there, abort the
          // whole move — a locked pair is never split across teams, and
          // never left half-moved.
          const partnerId = partnerOf(playerId);
          const partnerStack = partnerId
            ? state.stacks.find(
                (s) =>
                  s.courtId === null &&
                  (s.team1.playerIds.includes(partnerId) ||
                    s.team2.playerIds.includes(partnerId)),
              )
            : undefined;

          if (partnerStack && partnerId) {
            const excludeId = partnerStack.id === toStackId ? partnerId : undefined;
            if (!hasPairRoom(to, excludeId)) {
              moved = false;
              return;
            }
          }

          from.team1.playerIds = from.team1.playerIds.filter((id) => id !== playerId);
          from.team2.playerIds = from.team2.playerIds.filter((id) => id !== playerId);
          dropIfEmpty(from);

          if (partnerStack && partnerId) {
            partnerStack.team1.playerIds = partnerStack.team1.playerIds.filter(
              (id) => id !== partnerId,
            );
            partnerStack.team2.playerIds = partnerStack.team2.playerIds.filter(
              (id) => id !== partnerId,
            );
            // If the partner was already in `to`, don't drop it here even if
            // it's momentarily empty — it's about to be repopulated below.
            if (partnerStack.id !== to.id) dropIfEmpty(partnerStack);
          }

          seatPlayersInStack(
            to,
            partnerStack && partnerId ? [playerId, partnerId] : [playerId],
          );
        });
        return moved;
      },

      movePlayerToNewStack: (fromStackId, playerId, type = "default") =>
        set((state) => {
          const from = state.stacks.find((s) => s.id === fromStackId);
          if (!from) return;

          const dropIfEmpty = (s: Stack) => {
            // Emptied stack must be deleted, not hidden — see
            // removeSinglePlayerFromStack for why a stale empty stack is a bug.
            if (s.team1.playerIds.length === 0 && s.team2.playerIds.length === 0) {
              state.stacks = state.stacks.filter((x) => x.id !== s.id);
              if (state.pinnedStackId === s.id) state.pinnedStackId = null;
            }
          };

          // A locked partner queued elsewhere comes along into the new stack.
          const partnerId = partnerOf(playerId);
          const partnerStack = partnerId
            ? state.stacks.find(
                (s) =>
                  s.courtId === null &&
                  (s.team1.playerIds.includes(partnerId) ||
                    s.team2.playerIds.includes(partnerId)),
              )
            : undefined;

          from.team1.playerIds = from.team1.playerIds.filter((id) => id !== playerId);
          from.team2.playerIds = from.team2.playerIds.filter((id) => id !== playerId);
          dropIfEmpty(from);

          const movingIds = [playerId];
          if (partnerStack && partnerId) {
            partnerStack.team1.playerIds = partnerStack.team1.playerIds.filter(
              (id) => id !== partnerId,
            );
            partnerStack.team2.playerIds = partnerStack.team2.playerIds.filter(
              (id) => id !== partnerId,
            );
            dropIfEmpty(partnerStack);
            movingIds.push(partnerId);
          }

          const newStack: Stack = {
            id: uid(),
            courtId: null,
            type,
            team1: { playerIds: movingIds },
            team2: { playerIds: [] },
            createdAt: new Date().toISOString(),
            gameStartedAt: null,
          };
          state.stacks.push(newStack);
        }),

      swapPlayersBetweenStacks: (stackAId, playerAId, stackBId, playerBId) =>
        set((state) => {
          const stackA = state.stacks.find((s) => s.id === stackAId);
          const stackB = state.stacks.find((s) => s.id === stackBId);
          if (!stackA || !stackB) return;
          const aInTeam1 = stackA.team1.playerIds.includes(playerAId);
          const bInTeam1 = stackB.team1.playerIds.includes(playerBId);
          if (aInTeam1) {
            const i = stackA.team1.playerIds.indexOf(playerAId);
            stackA.team1.playerIds[i] = playerBId;
          } else {
            const i = stackA.team2.playerIds.indexOf(playerAId);
            stackA.team2.playerIds[i] = playerBId;
          }
          if (bInTeam1) {
            const i = stackB.team1.playerIds.indexOf(playerBId);
            stackB.team1.playerIds[i] = playerAId;
          } else {
            const i = stackB.team2.playerIds.indexOf(playerBId);
            stackB.team2.playerIds[i] = playerAId;
          }
        }),

      autoFillQueue: (group) =>
        set((state) => {
          const { updates, removedIds } = planAutoFill(state.stacks, group);
          if (updates.size === 0 && removedIds.size === 0) return;

          for (const s of state.stacks) {
            const u = updates.get(s.id);
            if (u) {
              s.team1.playerIds = u.team1;
              s.team2.playerIds = u.team2;
            }
          }

          if (removedIds.size > 0) {
            state.stacks = state.stacks.filter((s) => !removedIds.has(s.id));
            if (state.pinnedStackId && removedIds.has(state.pinnedStackId)) {
              state.pinnedStackId = null;
            }
          }
        }),

      canAutoFillQueue: (group) => planAutoFill(get().stacks, group).changed,

      clearAll: () =>
        set((state) => {
          state.stacks = [];
          state.pinnedStackId = null;
        }),

      getSuggestedNextStack: () => {
        const state = get();
        const ready = state.stacks.filter(
          (s) =>
            s.courtId === null &&
            s.team1.playerIds.length + s.team2.playerIds.length === 4,
        );
        const pinned = ready.find((s) => s.id === state.pinnedStackId);
        return pinned ?? ready[0];
      },

      getNextQueuedStack: () => {
        const state = get();
        const pinned = state.stacks.find(
          (s) => s.id === state.pinnedStackId && s.courtId === null,
        );
        if (pinned) return pinned;
        return state.stacks.find((s) => s.courtId === null);
      },
    })),
    {
      name: "stack-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

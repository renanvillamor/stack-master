import { useQuorumStore } from "@/store/quorumStore";
import { usePlayerStore } from "@/store/playerStore";
import { useStackStore } from "@/store/stackStore";
import { Player } from "@/types";

/**
 * Ids in `playerIds` whose locked partner exists but isn't also in
 * `playerIds` — i.e. including them in a quorum would strand their partner
 * outside it. Powers the "remove the lock-pairing first" warning shown by
 * both quorum-creation flows.
 */
export function findLockedOutsideQuorum(
  playerIds: string[],
  players: Player[],
): { playerId: string; playerName: string; partnerName: string }[] {
  const result: { playerId: string; playerName: string; partnerName: string }[] =
    [];
  for (const id of playerIds) {
    const player = players.find((p) => p.id === id);
    if (!player?.lockedPartnerId) continue;
    if (playerIds.includes(player.lockedPartnerId)) continue;
    const partner = players.find((p) => p.id === player.lockedPartnerId);
    result.push({
      playerId: player.id,
      playerName: player.name,
      partnerName: partner?.name ?? "Unknown",
    });
  }
  return result;
}

/**
 * Attempts to bring a quorum's 4 members together into one queued stack.
 * No-ops if any member is currently on a court (Playing) — the group waits
 * until everyone is free, regardless of Idle/Available/Stacked status.
 * Otherwise pulls every member out of wherever they're currently queued and
 * seats all 4 together in a brand-new stack, appended to the back of the
 * queue like any other freshly-created stack.
 */
export function tryConsolidateQuorum(quorumId: string): void {
  const quorum = useQuorumStore.getState().quorums.find((q) => q.id === quorumId);
  if (!quorum) return;

  const players = usePlayerStore.getState().players;
  const allFree = quorum.playerIds.every((id) => {
    const player = players.find((p) => p.id === id);
    return !!player && player.status !== "Playing";
  });
  if (!allFree) return;

  const stackStore = useStackStore.getState();

  const together = stackStore.stacks.find((s) => {
    if (s.courtId !== null) return false;
    const seated = [...s.team1.playerIds, ...s.team2.playerIds];
    return seated.length === 4 && quorum.playerIds.every((id) => seated.includes(id));
  });
  if (together) {
    if (quorum.stackId !== together.id) {
      useQuorumStore.getState().setQuorumStack(quorum.id, together.id);
    }
    return;
  }

  for (const playerId of quorum.playerIds) {
    const currentStack = useStackStore
      .getState()
      .stacks.find(
        (s) =>
          s.courtId === null &&
          (s.team1.playerIds.includes(playerId) ||
            s.team2.playerIds.includes(playerId)),
      );
    if (currentStack) {
      useStackStore
        .getState()
        .removeSinglePlayerFromStack(currentStack.id, playerId);
    }
  }

  useStackStore.getState().addPlayersToNewStack(quorum.playerIds);

  quorum.playerIds.forEach((id) =>
    usePlayerStore.getState().updatePlayerStatus(id, "Stacked"),
  );

  const newStack = useStackStore
    .getState()
    .stacks.find((s) =>
      quorum.playerIds.every(
        (id) =>
          s.team1.playerIds.includes(id) || s.team2.playerIds.includes(id),
      ),
    );
  if (newStack) {
    useQuorumStore.getState().setQuorumStack(quorum.id, newStack.id);
  }
}

/** Checks every distinct quorum touching `playerIds` for consolidation — call whenever any of these players stops being "Playing". */
export function checkQuorumsForPlayers(playerIds: string[]): void {
  const quorums = useQuorumStore.getState().quorums;
  const affectedQuorumIds = new Set<string>();
  for (const id of playerIds) {
    const quorum = quorums.find((q) => q.playerIds.includes(id));
    if (quorum) affectedQuorumIds.add(quorum.id);
  }
  affectedQuorumIds.forEach((id) => tryConsolidateQuorum(id));
}

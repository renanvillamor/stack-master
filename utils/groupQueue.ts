import { PlayerRating, Stack } from "@/types";

export type PlayerGroupKey = "beginner" | "advanced";

/** Beginners are players rated NR or 2.0 and below. */
export function getPlayerGroup(rating: PlayerRating): PlayerGroupKey {
  if (rating === "NR") return "beginner";
  return rating <= 2 ? "beginner" : "advanced";
}

/** Infers a stack's group from its first assigned player. Empty stacks have no group. */
export function getStackGroup(
  stack: Stack,
  getRating: (playerId: string) => PlayerRating,
): PlayerGroupKey | null {
  const firstId =
    stack.team1.playerIds[0] ??
    stack.team1.playerIds[1] ??
    stack.team2.playerIds[0] ??
    stack.team2.playerIds[1];
  return firstId ? getPlayerGroup(getRating(firstId)) : null;
}

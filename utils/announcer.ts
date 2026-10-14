import { Stack } from "@/types";
import * as Speech from "expo-speech";

const joinTeam = (names: string[]) => names.join(" and ");

/**
 * "Next Match: A and B versus C and D. Please proceed to Court 1." When no
 * court is known yet (queued stack, every court busy), players are told to
 * wait for the next free court instead.
 */
export function buildMatchAnnouncement(
  stack: Stack,
  getPlayerName: (playerId: string) => string,
  courtName: string | null,
): string {
  const team1 = joinTeam(stack.team1.playerIds.map(getPlayerName));
  const team2 = joinTeam(stack.team2.playerIds.map(getPlayerName));
  const destination = courtName
    ? `Please proceed to ${courtName}.`
    : "Please get ready for the next available court.";
  return `Next Match: ${team1} versus ${team2}. ${destination}`;
}

/** Speaks the match call-out, cutting off any announcement still playing. */
export function announceMatch(
  stack: Stack,
  getPlayerName: (playerId: string) => string,
  courtName: string | null,
): void {
  Speech.stop();
  Speech.speak(buildMatchAnnouncement(stack, getPlayerName, courtName), {
    rate: 0.9,
  });
}

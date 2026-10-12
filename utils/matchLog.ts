import { GameLogEntry, Player } from "@/types";

// Records written for the same game land a few ms apart (one recordGameResult
// call per player), so anything within this window with the same lineup is
// treated as one game.
const SAME_GAME_WINDOW_MS = 60_000;

const lineupKey = (winnerIds: string[], loserIds: string[]) =>
  `${[...winnerIds].sort().join(",")}|${[...loserIds].sort().join(",")}`;

/**
 * Rebuilds the session's game log from every player's match history, newest
 * first. Each game is stored once per participant, so records are merged by
 * lineup + time; reading both win and loss records means a game still shows
 * up even if some of its players were deleted since.
 */
export function buildGameLog(players: Player[]): GameLogEntry[] {
  const games: (GameLogEntry & { key: string; time: number })[] = [];

  for (const player of players) {
    for (const record of player.history ?? []) {
      const myTeam = [player.id, ...(record.teammateIds ?? [])];
      const otherTeam = record.opponentIds ?? [];
      const winnerIds = record.result === "win" ? myTeam : otherTeam;
      const loserIds = record.result === "win" ? otherTeam : myTeam;
      const key = lineupKey(winnerIds, loserIds);
      const time = new Date(record.date).getTime();

      const existing = games.find(
        (g) => g.key === key && Math.abs(g.time - time) <= SAME_GAME_WINDOW_MS,
      );
      if (existing) {
        if (time < existing.time) {
          existing.time = time;
          existing.date = record.date;
        }
        existing.gameStartedAt ??= record.gameStartedAt ?? null;
        continue;
      }
      games.push({
        key,
        time,
        date: record.date,
        gameStartedAt: record.gameStartedAt ?? null,
        winnerIds,
        loserIds,
      });
    }
  }

  return games
    .sort((a, b) => b.time - a.time)
    .map(({ key, time, ...game }) => game);
}

export interface MatchLogStats {
  /** Mean games played per player, over players with at least one game. */
  avgMatchCount: number | null;
  /** Mean game length in ms, over games with a recorded start time. */
  avgGameMs: number | null;
  /**
   * Mean time a player sat out between consecutive games of theirs (previous
   * game's end → next game's start), in ms. Time before a player's first game
   * isn't known (no join time is tracked), so it's not counted.
   */
  avgWaitMs: number | null;
}

const mean = (values: number[]) =>
  values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

export function computeMatchLogStats(
  players: Player[],
  games: GameLogEntry[],
): MatchLogStats {
  const matchCounts = players
    .map((p) => p.history?.length ?? 0)
    .filter((n) => n > 0);

  const gameDurations = games
    .filter((g) => g.gameStartedAt)
    .map(
      (g) => new Date(g.date).getTime() - new Date(g.gameStartedAt!).getTime(),
    )
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const waits: number[] = [];
  for (const player of players) {
    const history = [...(player.history ?? [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    for (let i = 1; i < history.length; i++) {
      const start = history[i].gameStartedAt;
      if (!start) continue;
      const wait =
        new Date(start).getTime() - new Date(history[i - 1].date).getTime();
      if (Number.isFinite(wait) && wait >= 0) waits.push(wait);
    }
  }

  return {
    avgMatchCount: mean(matchCounts),
    avgGameMs: mean(gameDurations),
    avgWaitMs: mean(waits),
  };
}

import { Player, StandingRow } from "@/types";

/**
 * Leaderboard order: most wins, then fewest losses (with equal wins that's
 * the same as the better win rate), then name, which only orders players
 * sharing a rank. Players with the same W–L record share a competition rank
 * (1, 2, 2, 4). Players with no games aren't ranked and go last.
 */
export function computeStandings(players: Player[]): StandingRow[] {
  const rows = players
    .map((player) => {
      const wins = player.history.filter((r) => r.result === "win").length;
      const losses = player.history.filter((r) => r.result === "loss").length;
      return { player, wins, losses, matches: player.matches };
    })
    .sort((a, b) => {
      const aRanked = a.matches > 0 ? 1 : 0;
      const bRanked = b.matches > 0 ? 1 : 0;
      if (aRanked !== bRanked) return bRanked - aRanked;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.player.name.localeCompare(b.player.name);
    });

  // Group consecutive same-record ranked rows; each group shares one rank.
  const groups: (typeof rows)[] = [];
  for (const row of rows) {
    if (row.matches === 0) break;
    const last = groups[groups.length - 1];
    if (last && last[0].wins === row.wins && last[0].losses === row.losses) {
      last.push(row);
    } else {
      groups.push([row]);
    }
  }

  const result: StandingRow[] = [];
  let position = 1;
  groups.forEach((group, i) => {
    const next = groups[i + 1];
    const edge: StandingRow["edge"] = next
      ? next[0].wins !== group[0].wins
        ? {
            by: "wins",
            margin: group[0].wins - next[0].wins,
            over: next.map((r) => r.player.name),
          }
        : {
            by: "losses",
            margin: next[0].losses - group[0].losses,
            over: next.map((r) => r.player.name),
          }
      : null;
    for (const row of group) {
      result.push({ ...row, rank: position, tied: group.length > 1, edge });
    }
    position += group.length;
  });

  for (const row of rows.slice(result.length)) {
    result.push({ ...row, rank: null, tied: false, edge: null });
  }
  return result;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "Ben", "Ben & Cara", "Ben & 2 others". */
function names(over: string[]): string {
  if (over.length === 1) return over[0];
  if (over.length === 2) return `${over[0]} & ${over[1]}`;
  return `${over[0]} & ${over.length - 1} others`;
}

/**
 * Explainer under a player's name, or null when there's nothing worth saying.
 * Leaders always say how they lead; everyone else only when the tiebreaker
 * (fewer losses) is what put them ahead, since "more wins" is visible at a glance.
 */
export function describeEdge(row: StandingRow): string | null {
  if (!row.edge) return null;
  const { by, margin, over } = row.edge;
  if (by === "wins") {
    return row.rank === 1
      ? `Leads ${names(over)} by ${plural(margin, "win", "wins")}`
      : null;
  }
  return `${row.rank === 1 ? "Leads" : "Ahead of"} ${names(over)}: same wins, ${plural(margin, "fewer loss", "fewer losses")}`;
}

// ─── Court ───────────────────────────────────────────────────────────────────

export interface Court {
  id: string;
  name: string;
}

// ─── Player ──────────────────────────────────────────────────────────────────

export type PlayerRating = number | "NR";

export type PlayerStatus =
  "Available" | "Idle" | "Stacked" | "Playing" | "Inactive";

export type MatchResult = "win" | "loss";

export interface MatchRecord {
  date: string; // ISO string
  result: MatchResult;
  teammateIds: string[];
  opponentIds: string[];
  gameStartedAt?: string | null; // ISO; absent on records saved before durations were tracked
}

// One finished game, reconstructed from the 4 players' MatchRecords (there is
// no separate game log — see utils/matchLog.ts).
export interface GameLogEntry {
  date: string; // ISO string — when the game ended
  gameStartedAt: string | null; // null when unknown (older records)
  winnerIds: string[];
  loserIds: string[];
}

export interface Player {
  id: string;
  name: string;
  rating: PlayerRating;
  status: PlayerStatus;
  matches: number;
  lastPlayed: string | null;
  history: MatchRecord[];
  /** Id of the player this player is lock-paired with for the session, or null if unpaired. */
  lockedPartnerId: string | null;
}

// ─── Stack ───────────────────────────────────────────────────────────────────

export interface Team {
  playerIds: string[];
}

export type StackType = "default" | "winners" | "losers";

export interface Stack {
  id: string;
  courtId: string | null;
  type: StackType;
  team1: Team;
  team2: Team;
  createdAt: string;
  /** Set when the stack is assigned to a court (game start); cleared when it leaves the court. */
  gameStartedAt: string | null;
}

// ─── Team ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  rating: PlayerRating;
  active: boolean;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface Settings {
  shufflePlayers: boolean;
  autoStackPlayers: boolean;
  multiGroupStack: boolean;
}

// A text-to-speech voice installed on this device, as shown in the announcer
// voice picker. `id` is the engine's voice identifier passed to expo-speech.
export interface AnnouncerVoice {
  id: string;
  label: string; // e.g. "English (US) · Voice 2"
  language: string; // e.g. "en-US"
  enhanced: boolean; // engine reports higher-than-normal quality
}

// ─── Quorum ──────────────────────────────────────────────────────────────────

export interface Quorum {
  id: string;
  /** Exactly 4 player ids, fixed at creation. */
  playerIds: string[];
  /** The stack currently holding all 4 members together, or null while still waiting on someone. */
  stackId: string | null;
  createdAt: string;
}

// ─── Session Sync ────────────────────────────────────────────────────────────

export type SessionRole = "host" | "guest" | null;

export interface GuestPresence {
  id: string;
  name: string;
}

/** Everything a guest needs to render read-only Court/Stack screens, pushed by the host on every relevant store change. */
export interface SessionSnapshot {
  courts: Court[];
  stacks: Stack[];
  players: Player[];
  pinnedStackId: string | null;
  quorums: Quorum[];
  /** Host's multi-group (Beginner/Advanced) stacking setting — guests mirror the host's queue layout rather than their own local preference. */
  multiGroupStack: boolean;
}

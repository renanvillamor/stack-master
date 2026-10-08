9# StackMaster

StackMaster is an Expo React Native app for running pickleball "stacking" sessions — queueing players into foursomes (two teams of two), assigning foursomes to courts, recording match results, and re-queueing winners/losers. This file is the single source of truth for how the app is built and how it behaves; keep it in sync with the code whenever either changes.

---

## Tech Stack

| Layer         | Technology                                                                             |
| ------------- | -------------------------------------------------------------------------------------- |
| Framework     | Expo SDK 55 (React Native 0.83, React 19)                                              |
| Navigation    | Expo Router v5 — file-based, one bottom-tab group                                      |
| UI Components | React Native Paper v5 (Material Design 3)                                              |
| Bottom sheets | `@gorhom/bottom-sheet` (wrapped in `BottomSheetModalProvider`)                         |
| Styling       | NativeWind v4 (Tailwind) for layout + inline `theme.colors.*` for color/detail styling |
| State / Store | Zustand v5 + Immer middleware                                                          |
| Persistence   | Zustand `persist` + `@react-native-async-storage/async-storage`                        |
| Dates         | `date-fns`                                                                             |
| Realtime sync | Supabase (`@supabase/supabase-js`) — see "Session Sync" below                          |
| QR codes      | `react-native-qrcode-svg` (generate) + `expo-camera` (scan)                            |
| Language      | TypeScript (`strict: true`)                                                            |

Path alias: **`@/*` → repo root** (`tsconfig.json`). Always import via `@/store/...`, `@/components/...`, `@/utils/...`, `@/types`, never relative paths across top-level folders.

`patches/` (via `patch-package`, runs on `postinstall`) patches `expo-modules-core`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens` (+ `-jni`), and `react-native-worklets` — the gesture-handler/reanimated/screens cluster that `@gorhom/bottom-sheet` depends on. Run `npm install` after cloning so these apply; regenerate the relevant patch if you upgrade any of those packages.

App is **light-mode only**: `app.json` sets `userInterfaceStyle: "light"` and `app/_layout.tsx` hardcodes `<PaperProvider theme={lightTheme}>`. Orientation is unlocked (`app.json` → `orientation: "default"`), so every list screen has to handle portrait/landscape itself (see "Landscape & columns" below).

Session Sync (see below) needs a Supabase project's `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` in a local `.env` (see `.env.example`; gitignored). Without them, hosting/joining fails but the rest of the app is unaffected.

---

## Project Structure

```
app/
  _layout.tsx          # Root: GestureHandlerRootView > SafeAreaProvider > BottomSheetModalProvider > PaperProvider(lightTheme) > Router Stack
  modal.tsx             # Vestigial Expo-template scaffold screen — not reachable from the tab bar, not part of the real app
  (tabs)/
    _layout.tsx         # Bottom tab navigator: Court, Stack, Players, Settings
    index.tsx           # Court screen (tab title "Court")
    stack.tsx            # Stack screen (the queue)
    player.tsx           # Players screen (roster)
    settings.tsx          # Settings screen

components/
  common/
    ActionBottomSheet.tsx        # Generic "⋮ more menu" bottom sheet — powers every action menu in the app
    OptionPickerSheet.tsx        # Generic single-select bottom sheet (status filter, sort-by)
    ConfirmDialog.tsx            # Cancel/Confirm dialog
    AlertDialog.tsx               # Single-button OK dialog (errors/notices)
    WinnerDialog.tsx              # "Which team won?" dialog shown when ending a court game
  court/
    CourtCard.tsx                 # Court list item: teams, elapsed time, END GAME button
    CourtFormModal.tsx            # Add/edit court name
    NextStackPromptDialog.tsx     # Post-game: "move this ready stack onto the freed court?"
    IncompleteStackPromptDialog.tsx # Post-game: next stack isn't full yet — offers alternatives
    GuestCourtView.tsx             # Read-only Court screen for guests, sourced from sessionStore.remoteSnapshot
  player/
    PlayerCard.tsx                 # Roster list item with status chip, rating, lock/quorum icons
    PlayerFormModal.tsx            # Add/edit player(s); comma-separated names = bulk add
    PlayerMatchHistoryDialog.tsx   # One player's match log
    PlayerStandingsDialog.tsx      # Leaderboard (wins desc, matches desc, name asc)
  stack/
    StackCard.tsx                  # Queue card: two teams, badges, Move to Court button
    CourtPickerModal.tsx           # Pick a destination court
    MoveToStackDialog.tsx          # Pick a destination queued stack for "Move to Stack"
    PlayerPickerDialog.tsx         # Generic "pick a player" grid, used by all swap flows
    GuestStackView.tsx             # Read-only Stack screen for guests, sourced from sessionStore.remoteSnapshot
  team/
    TeamManagementModal.tsx        # Persistent "team roster" (separate from live players) used to seed a new session
    TeamMemberFormModal.tsx        # Add/edit team roster member(s)
  session/
    GuestSessionBanner.tsx         # Guest's only exit from a joined session (Player/Settings tabs are hidden to them)
  settings/
    SessionSyncSection.tsx         # Settings card: Host/Join controls, QR + code + live guest list while hosting
    JoinSessionModal.tsx           # QR scan (expo-camera, default step) / code entry fallback / guest-name prompt, 3-step dialog
    ShareAppDialog.tsx             # QR + copyable direct-download link to the latest release's APK, native Share sheet, live download count
  Themed.tsx, StyledText.tsx, ExternalLink.tsx, EditScreenInfo.tsx,
  useColorScheme.ts(.web.ts), useClientOnlyValue.ts(.web.ts)
                                    # Expo-template scaffolding, only wired to app/modal.tsx — dead weight for
                                    # the real feature set, which is 100% react-native-paper themed. Don't
                                    # build new features on top of these.

store/
  courtStore.ts     # Courts CRUD
  playerStore.ts     # Players CRUD, status, match history, lock-pairing
  stackStore.ts       # Queue: the core stacking/queueing engine (biggest, most load-bearing file in the app)
  quorumStore.ts       # Saved 4-player groups ("always play together")
  settingsStore.ts     # App-wide toggles
  teamStore.ts          # Persistent team roster (separate from playerStore)
  sessionStore.ts        # Host/guest role + live-session state — see "Session Sync" below

types/index.ts        # All shared TypeScript interfaces/types — define new shared types here, never duplicate locally
theme/index.ts          # React Native Paper MD3 theme (green palette) — the app's real design tokens
lib/supabase.ts          # Supabase client (anon key, no auth persistence) — reads EXPO_PUBLIC_SUPABASE_* env vars
supabase/schema.sql        # sessions table + RLS + RPCs — run in the Supabase SQL editor (idempotent)
utils/
  groupQueue.ts          # Beginner/advanced classification for multi-group stacking
  quorum.ts                # Quorum consolidation algorithm
  time.ts                   # formatLastPlayed() relative-time formatter
  sessionCode.ts             # generateSessionCode() — 6-char unambiguous session codes
  sessionSync.ts              # Supabase channel/presence/RPC wiring used by sessionStore

constants/Colors.ts     # Legacy Expo-template light/dark map — NOT the real palette (see Styling below)
global.css               # Tailwind base/components/utilities
tailwind.config.js        # NativeWind preset + green color tokens (mirrors theme/index.ts — keep in sync manually)
babel.config.js            # babel-preset-expo + nativewind/babel
metro.config.js             # withNativeWind(config, { input: './global.css' })
```

---

## Data Models (`types/index.ts`)

```typescript
interface Court {
  id: string;
  name: string;
}

type PlayerRating = number | "NR"; // 2.0–5.0 in 0.1 steps, or unrated
type PlayerStatus = "Available" | "Idle" | "Stacked" | "Playing" | "Inactive";
type MatchResult = "win" | "loss";

interface MatchRecord {
  date: string; // ISO
  result: MatchResult;
  teammateIds: string[];
  opponentIds: string[];
}

interface Player {
  id: string;
  name: string;
  rating: PlayerRating;
  status: PlayerStatus;
  matches: number;
  lastPlayed: string | null; // ISO
  history: MatchRecord[];
  lockedPartnerId: string | null; // session pairing — see "Locked pairs" below
}

interface Team {
  playerIds: string[]; // max 2
}

type StackType = "default" | "winners" | "losers";

interface Stack {
  id: string;
  courtId: string | null; // null = still in the queue
  type: StackType;
  team1: Team;
  team2: Team; // 4 players total = "Ready"
  createdAt: string; // ISO
  gameStartedAt: string | null; // set when assigned to a court, cleared when returned to queue
}

interface TeamMember {
  id: string;
  name: string;
  rating: PlayerRating;
  active: boolean; // whether this member is included when seeding a new session
}

interface Settings {
  shufflePlayers: boolean;
  autoStackPlayers: boolean;
  multiGroupStack: boolean;
}

interface Quorum {
  id: string;
  playerIds: string[]; // exactly 4, fixed at creation
  stackId: string | null; // the stack currently holding all 4 together, or null while waiting
  createdAt: string;
}

type SessionRole = "host" | "guest" | null;

interface GuestPresence {
  id: string;
  name: string;
}

// Everything a guest needs to render read-only Court/Stack screens; pushed by
// the host on every relevant store change. See "Session Sync" below.
interface SessionSnapshot {
  courts: Court[];
  stacks: Stack[];
  players: Player[];
  pinnedStackId: string | null;
  quorums: Quorum[];
}
```

---

## Store Pattern

All stores follow the same shape — `persist` wraps `immer`:

```typescript
export const useXxxStore = create<XxxState>()(
  persist(
    immer((set, get) => ({
      // state fields
      // action methods using Immer draft mutations inside set()
    })),
    { name: "xxx-storage", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
```

IDs everywhere are generated with `` `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}` `` (a `uid()` helper duplicated per store file, not shared).

Cross-store reads use `useXStore.getState()` inside another store's action (e.g. `stackStore` reads `usePlayerStore.getState()` for ratings/lock-pairing and `useQuorumStore.getState()` to avoid touching quorum stacks) — there is no centralized "root store"; stores talk to each other directly via `getState()`.

### `store/courtStore.ts`

`courts: Court[]`. `addCourt(name)`, `editCourt(id, name)`, `removeCourt(id)`, `clearAll()`. Nothing else — courts are just named containers that a `Stack` attaches to via `courtId`.

### `store/playerStore.ts`

`players: Player[]`.

- `addPlayer(name, rating)` — new player starts `status: "Available"`, `matches: 0`, empty history, unlocked.
- `editPlayer(id, name, rating)`, `removePlayer(id)` (also frees the removed player's locked partner), `updatePlayerStatus(id, status)`.
- `recordGameResult(id, result, teammateIds, opponentIds)` — increments `matches`, sets `lastPlayed`, appends a `MatchRecord`. Called once per player (not once per game) by the Court screen when a game ends.
- `lockPlayers(idA, idB)` / `unlockPlayer(id)` — session pairing (see "Locked pairs" below). Locking breaks either player's existing pairing first.
- `clearAll()`.

### `store/quorumStore.ts`

`quorums: Quorum[]`. `createQuorum(playerIds, stackId?)` (returns new id), `removeQuorum(id)`, `removeQuorumForStack(stackId)`, `removeQuorumForPlayer(playerId)`, `setQuorumStack(id, stackId | null)`, `getQuorumForPlayer(id)`, `getQuorumForStack(stackId)`, `clearAll()`. See "Quorums" section below for the full lifecycle — the store is just CRUD; the algorithm lives in `utils/quorum.ts`.

### `store/settingsStore.ts`

- `shufflePlayers` (default `true`) — on game end, split winners/losers onto opposite teams instead of keeping them as teammates.
- `autoStackPlayers` (default `true`) — on game end, automatically re-queue players into winner/loser stacks; when off, players just go back to `"Available"` and the game stack is discarded.
- `landscapeColumns: 1 | 2 | 3` (default `2`) — grid column count in landscape for Court/Player/single-group-Stack screens.
- `multiGroupStack` (default `true`) — splits the Stack screen into separate Beginner/Advanced queues (see "Multi-group stacking").

### `store/teamStore.ts`

A **persistent roster separate from `playerStore`**: `teamName`, `members: TeamMember[]` (each with an `active` flag). Used only by Settings → "New Session" to reseed `playerStore` after a wipe, and by `TeamManagementModal`/`TeamMemberFormModal`. Not touched by any in-session gameplay logic.

### `store/sessionStore.ts`

Host/guest role and live-session connection state. Unlike the other stores, only a small identity subset is persisted (via `persist`'s `partialize`) — `role`, `sessionId`, `hostKey`, `guestId`, `guestName` — never the ephemeral `remoteSnapshot`/`guestsPresent`/`connectionStatus`, since those are refetched on reconnect. The actual Supabase `RealtimeChannel` and store-subscription teardown functions live in module state inside `utils/sessionSync.ts`, not in the Zustand store, since channels aren't serializable.

- `role: "host" | "guest" | null`, `sessionId`, `hostKey` (host only), `guestId` (generated once per device, used as the realtime presence key), `guestName`, `connectionStatus`, `guestsPresent: GuestPresence[]` (host only), `remoteSnapshot: SessionSnapshot | null` (guest only), `sessionEnded` (guest-only flag set when the host stops hosting).
- `startHosting()` — generates a 6-char code (`utils/sessionCode.ts`), retries on collision, creates the Supabase row, and opens the host sync channel.
- `stopHosting()` — broadcasts `session_ended`, deletes the Supabase row, tears down the channel/subscriptions.
- `joinSession(code, name)` — validates the code exists, seeds `remoteSnapshot`, opens the guest sync channel, tracks presence.
- `leaveSession()` — untracks presence, tears down the channel, clears role.
- `rehydrateConnection()` — called once from `app/_layout.tsx` on launch; re-opens the channel for a role/session restored from persisted storage (so a killed-and-reopened host/guest app keeps working).

See "Session Sync" below for the full host/guest architecture.

### `store/stackStore.ts` — the queueing engine

`stacks: Stack[]`, `pinnedStackId: string | null`. This is the largest and most important file in the app — read it before changing any queueing/stacking behavior. Key concepts:

- **A "queued" stack** has `courtId === null`. **Full** means both teams total 4 players. Stacks are always ordered by insertion order (array order = queue order), except a `pinnedStackId` (`setPinnedStack`) that jumps to the front for "next up" purposes without physically reordering the array.
- **`type`**: `"default" | "winners" | "losers"` — winner/loser queues are just stacks tagged by type; queueing helpers accept a `type` param and only route within same-type stacks (a "Move to Stack"/auto-fill operation still crosses types freely though — see below).
- **Locked-pair awareness is pervasive**: nearly every mutation (`addToQueue`, `addManyToQueue`, `removeSinglePlayerFromStack`, `movePlayerBetweenStacks`, `movePlayerToNewStack`, `processGameResult`, auto-fill) checks `lockedPartnerId` and keeps a locked pair seated on the **same team**, moves them together, and never splits them across stacks — a move that would strand a pair on the same team is aborted with `moved = false` rather than partially applied.
- **`placeOnTeams` / `seatPlayersInStack`**: shared seating primitives. A locked pair with both members in the batch always claims a whole team (2 free seats) together, or spins off a new stack if the destination can't fit them as a pair; a single player whose partner is already seated joins the partner's team if there's room; anything left fills team1 then team2.
- **`addPlayerToStack` / `addPlayerToWinnerStack` / `addPlayerToLoserStack`** — single-player convenience wrappers around `addToQueue(stacks, playerId, type)`. Prefers joining the player's locked partner's existing stack; otherwise the first open stack of matching type (and matching group, if multi-group stacking is on); otherwise creates a new stack.
- **`addManyPlayersToQueue(playerIds, type?)`** — batch add; locked pairs present in the same batch are seated first (each claiming a whole team atomically) so unrelated players in the batch can never fill a seat a partner needs.
- **`addPlayersToNewStack(playerIds, type?)`** — always creates one brand-new stack (used by quorum consolidation).
- **`addSplitPlayersToNewStack(id1, id2, type?)`** — new stack with id1 on team1, id2 on team2 (opposite teams).
- **`addPlayersToTypeQueue(playerIds, type?)`** — atomic "find or create" for a batch that must land together in one existing/new stack.
- **`assignCourtToStack(stackId, courtId)`** — sets `courtId` + `gameStartedAt`, unpins if it was pinned.
- **`returnStackToQueue(stackId)`** — clears `courtId`/`gameStartedAt` ("Back to Stack" court action).
- **`removeStack(id)`** — deletes and returns the stack (caller frees the players).
- **`movePlayerBetweenTeams` / `swapPlayersBetweenTeams`** — within one stack.
- **`removeSinglePlayerFromStack(stackId, playerId)`** — removes the player (and their locked partner if also queued elsewhere), deletes the stack if left empty (a stale empty stack would otherwise be silently picked up as "oldest" later — always delete on empty, never leave a hollow stack behind), returns every id actually removed.
- **`movePlayerBetweenStacks(fromStackId, playerId, toStackId)`** — moves a player (and locked partner) to another stack; **aborts entirely (returns `false`) if the destination can't fit the pair together** rather than splitting them.
- **`movePlayerToNewStack(fromStackId, playerId, type?)`** — pulls a player (+ locked partner) out into a fresh stack.
- **`swapPlayersBetweenStacks`** — swaps two players (from different stacks) in place, preserving team position.
- **`processGameResult(gameStackId, winnerIds, loserIds, shuffle)`** — the single atomic action that ends a game: removes the game stack, then re-queues winners/losers. Rules, in priority order:
  1. **Cross-locked pairs** (a pair locked mid-game while split across winning/losing teams): the pair reunites in the **loser** queue; the teammates each of them leaves behind reunite together in the **winner** queue. (A lock formed _before_ the game already has both members on the same team, so this branch never fires for them.)
  2. Else if `shuffle` is on: winners and losers are each placed on **opposite teams** of their new stack (so today's winners don't stay teammates) — unless the 2 winners (or 2 losers) are themselves a locked pair, in which case they stay teammates regardless of shuffle.
  3. Else (`shuffle` off): winners re-queue together as teammates in the "winners" stack, losers together in "losers".
  - Any player locked-paired to someone in this game but not themselves in it (waiting Available, or queued elsewhere) is pulled in to reunite with their now-free partner — their ids are returned so the caller (Court screen) can sync their status to `"Stacked"`. A partner who is mid-match on another court is left alone until their own game ends.
- **`autoFillQueue(group?)` / `canAutoFillQueue(group?)`** — packs vacant slots in existing incomplete queued stacks forward (front stacks filled to 4 before later ones), so gaps collapse toward the back of the queue instead of the admin moving players one at a time. Buckets by group only (not by `type` — this mirrors the manual "Move to Stack" picker, which also ignores type) when `multiGroupStack` is on; `group` param restricts to just that column (used by the per-group auto-fill buttons on the Stack screen). Never touches a quorum's stack. Pure/no-op-safe: `canAutoFillQueue` runs the same planner read-only to decide whether to show/enable the button.
- **`getSuggestedNextStack()`** — oldest **full** queued stack, pinned stack takes priority once it's full. Used by "Move Next Available Stack".
- **`getNextQueuedStack()`** — the literal first stack in queue order regardless of fullness (pinned always wins). Used to decide which post-game prompt to show.

---

## Business Logic in `utils/`

### `utils/groupQueue.ts` — beginner/advanced classification

```typescript
getPlayerGroup(rating): "beginner" | "advanced"
```

`"NR"` or a numeric rating **`<= 2.0`** → `"beginner"`; anything `> 2.0` → `"advanced"`. (2.0 exactly is a beginner; 2.1 is advanced.)

```typescript
getStackGroup(stack, getRating): "beginner" | "advanced" | null
```

Infers a stack's group from its **first occupied slot** (`team1[0] → team1[1] → team2[0] → team2[1]`); an empty stack has no group (`null`). Consistency across all 4 seats is not re-verified here — it relies on multi-group-aware add/move logic never mixing groups into one stack in the first place.

### `utils/quorum.ts` — quorum consolidation

A **quorum** is a saved set of exactly 4 player ids that should always end up playing together.

- `findLockedOutsideQuorum(playerIds, players)` — returns every player in the candidate set whose locked partner exists but is **not** also in the set (would strand the partner). Used to block quorum creation whenever it would split a locked pair.
- `tryConsolidateQuorum(quorumId)` — the core algorithm:
  1. No-ops unless **all 4 members** have `status !== "Playing"` (Idle/Available/Stacked are fine — only "on a court" blocks it).
  2. If all 4 are already seated together in one full queued stack, just syncs `quorum.stackId` to it.
  3. Otherwise pulls each member out of wherever they're individually queued (`removeSinglePlayerFromStack`), creates one brand-new stack with all 4 via `addPlayersToNewStack`, marks all 4 `"Stacked"`, and binds `quorum.stackId` to the new stack.
- `checkQuorumsForPlayers(playerIds)` — finds every distinct quorum touching any of `playerIds` and re-runs `tryConsolidateQuorum` on each. Call this any time a set of players might have stopped `"Playing"` (game end, returning to queue).

**Quorums are one-shot**: the Court screen dissolves (`removeQuorum`) a quorum the instant its stack's game ends, _before_ re-routing players — a quorum does not automatically re-form after being consumed; the user must mark a new one.

### `utils/time.ts`

`formatLastPlayed(iso)` → `"Never"` (null/invalid) · `"Just now"` (≤0 min) · `"{n}m ago"` (<60 min) · `"{n}h ago"` (<24 hr) · `"{n}d ago"`. Used by `PlayerCard` and `StackCard`.

> **Known duplication**: `StackCard.tsx` implements its own near-identical `formatElapsed` for a stack's "created N ago" footer instead of reusing `formatLastPlayed` — formatting differs slightly (e.g. `"1 hr ago"` vs `"1h ago"`). If you touch relative-time formatting, update both or consolidate them.

---

## Screens

All four tab screens share a layout skeleton: `FlatList` of cards + a `numColumns` derived from `useWindowDimensions()` and `settingsStore.landscapeColumns` (see "Landscape & columns"), a FAB or header action to add an item, and an empty state.

### Court screen (`app/(tabs)/index.tsx`, tab title "Court")

Shows every court as a `CourtCard`: name, live elapsed-game timer (re-renders every 30s), both teams or dashed "Empty" slots, and an **END GAME** button (disabled unless a stack is assigned).

- **⋮ court menu**: Edit (`CourtFormModal`) · Move to Court (only if active — reassign the running game to a different empty court via `CourtPickerModal`) · Back to Stack (only if active — `returnStackToQueue`, marks the 4 players `"Stacked"`, runs `checkQuorumsForPlayers`) · Delete (destructive `ConfirmDialog` → `removeCourt`).
- **Tap a player row**: "Switch Team" action — locked players can't switch; if the other team has no unlocked candidate, shows an alert; otherwise opens `PlayerPickerDialog` → `swapPlayersBetweenTeams`.
- **FAB**: `CourtFormModal` with `defaultName="Court {n+1}"`.
- **END GAME flow** (`WinnerDialog` → pick winning team):
  1. `recordGameResult` for all 4 players (teammates/opponents assembled by the screen).
  2. Dissolve any quorum tied to this stack (`getQuorumForStack` → `removeQuorum`) — before re-routing.
  3. If `autoStackPlayers` is on: mark all 4 `"Stacked"`, call `processGameResult(stackId, winnerIds, loserIds, shufflePlayers)` (see stackStore); any locked partner pulled in also gets marked `"Stacked"`. If off: mark all 4 `"Available"` and just `removeStack(stackId)` (no re-queue).
  4. `checkQuorumsForPlayers(allIds)` — let any quorum touching these players try to reassemble.
  5. Look at `getNextQueuedStack()`: if full, show `NextStackPromptDialog` (offer to move it onto the just-freed court, via `assignCourtToStack` + mark 4 players `"Playing"`); if not full, show `IncompleteStackPromptDialog` offering either "Move Next Available Stack" (`getSuggestedNextStack()` — a looser, oldest-_ready_ search) or "Complete This Stack" (navigates to the Stack tab).

**Guest mode**: if `sessionStore.role === "guest"`, the screen renders `GuestSessionBanner` + `GuestCourtView` instead of the above — a read-only mirror sourced from `sessionStore.remoteSnapshot` (see "Session Sync" below). The early return sits after all hooks, before the host-only handlers/derived state.

### Stack screen (`app/(tabs)/stack.tsx`)

Manages the queue of unassigned stacks.

- **Normal mode** (`multiGroupStack` off): one `FlatList` of `StackCard`s, same landscape-column grid as other screens.
- **Multi-group mode** (`multiGroupStack` on): always a fixed **two-column** layout — "Beginners" and "Intermediate/Advanced" — bucketed via `getStackGroup`, ignoring `landscapeColumns`/orientation entirely; a third "Unsorted" section (empty stacks) appears below only if non-empty. Each column has its own auto-fill button (`canAutoFillQueue("beginner"|"advanced")`).
- **⋮ stack menu**: Set as Up Next / Unpin (`setPinnedStack`) · Mark as Quorum / Remove Quorum (only enabled when the stack is full; see below) · Clear Stack (confirm — removes all 4 players, marks `"Available"`, `removeQuorumForStack`).
- **Mark as Quorum**: blocked with an alert if `findLockedOutsideQuorum` finds a conflict, or if any of the 4 is already in another quorum; otherwise `createQuorum(playerIds, stackId)`.
- **Tap a player avatar** → Switch Team / Match History (`PlayerMatchHistoryDialog`, same as the Player tab) / Move to Stack / Remove from Stack (the latter two disabled if the stack is a quorum's stack).
  - **Move to Stack** (`MoveToStackDialog`, lists non-quorum queued stacks excluding the source): if the player has a locked partner queued elsewhere, uses the pair-aware `movePlayerBetweenStacks` (shows an alert if there's no room for both); otherwise moves directly if there's room, or opens a cross-stack swap (`PlayerPickerDialog` → `swapPlayersBetweenStacks`) if the destination is full. "New Stack" preserves the source stack's `type`.
  - **Remove from Stack**: confirm dialog (warns if a locked partner will also be removed) → `removeSinglePlayerFromStack`, mark removed ids `"Available"`.
- **Move to Court** (per-card, enabled only when full): 0 courts → auto-creates "Court 1" and assigns immediately; exactly 1 available court → assigns immediately, skipping the picker; otherwise `CourtPickerModal`. On selection: `assignCourtToStack` + mark all 4 players `"Playing"`.
- Empty state: "Stack is empty" — hint to long-press players on the Player tab.

**Guest mode**: same pattern as the Court screen — `sessionStore.role === "guest"` renders `GuestSessionBanner` + `GuestStackView` instead, a read-only mirror (including the multi-group column split) sourced from `sessionStore.remoteSnapshot`.

### Players screen (`app/(tabs)/player.tsx`)

Full roster management: search, status filter, sort, multi-select bulk actions, locking, quorums, add-to-stack, standings, match history.

- **Search/filter/sort** (client-side): substring search on name; status filter (`OptionPickerSheet`); sort by name / last-played / status (fixed order Available→Idle→Stacked→Playing→Inactive).
- **Selection mode**: long-press a card to enter; tap toggles selection while active; header shows count, select-all/none, and a bulk-actions icon.
- **Per-player ⋮ menu**: Edit · Match History · Idle (toggle, no-ops if `Stacked`/`Playing`) · Add to Stack (only if `Available`) · Unlock Pairing (only if locked) · Remove from Quorum (only if in one) · Delete (confirm → `removePlayer` + `removeQuorumForPlayer`).
- **Bulk menu** (selection mode): Idle toggle · Add to Stack (N) (only Available ones count) · Lock Pair / Unlock Pair (only when exactly 2 selected) · Create Quorum (only when exactly 4 selected and none already in a quorum) · Delete.
- **Add to Stack logic** (`getFittingStacks`): finds queued stacks with room; when multi-group stacking is on, restricted to stacks whose group matches the player(s) being added. 0 fitting stacks → new stack; 1 → add directly; >1 → inline stack-picker dialog with a "New Stack" escape hatch. Bulk add across a mixed beginner/advanced selection (multi-group on) splits into two batches automatically.
- **Lock Pair**: blocked with an alert if either selected player is already in a quorum, or (multi-group on) if the two players are in different groups — **locked pairs must share a group when multi-group stacking is enabled**.
- **Create Quorum**: same `findLockedOutsideQuorum` guard as the Stack screen; on success, immediately calls `tryConsolidateQuorum` to try seating all 4 right away.
- **Trophy icon** → `PlayerStandingsDialog` (leaderboard: wins desc → matches desc → name asc, top 3 medaled).

### Settings screen (`app/(tabs)/settings.tsx`)

- **Stack Configuration**: Landscape Columns (`SegmentedButtons` 1/2/3) · Multiple Group Stack switch · Auto-Stack Players switch ("Stack players into win/lose stack on game end") · Shuffle Players switch ("Split winners & losers onto opposite teams").
- **Live Sync** (`SessionSyncSection`): Host/Join controls — see "Session Sync" below. Only reachable when `role !== "guest"` (guests never see the Settings tab at all).
- **Session**: Team Management (opens `TeamManagementModal`, backed by `teamStore`) · **New Session** (destructive confirm; dialog text appends "N active team member(s) will be loaded automatically" when applicable). On confirm: wipes `stackStore`, `playerStore`, `courtStore` (`clearAll()` each), then re-adds one player per **active** team-roster member (`addPlayer(m.name, m.rating)`).
- **About**: static app version / coffee-link rows, not wired to anything · **Share StackMaster** opens `ShareAppDialog` — a QR code and copyable link to `APP_DOWNLOAD_URL` (`https://github.com/renanvillamor/stack-master/releases/latest/download/StackMaster.apk`, which GitHub redirects to the APK on the newest release — so **every release must attach the APK named exactly `StackMaster.apk`**) plus a "Share Link" button using React Native's `Share` API. On each open it fetches the GitHub Releases API (unauthenticated, 60 req/hr/IP) and shows the total `download_count` summed over all release assets as a pill; the pill is hidden if the fetch fails. Update the URL constants if the repo moves.

### `app/modal.tsx`

Leftover Expo-template scaffold screen (uses `Themed.tsx`/`EditScreenInfo.tsx`). Not linked from the tab bar or any in-app navigation — dead code, not part of the product. Don't extend it; if you need a modal, use React Native Paper `Modal`/`Dialog` inline in a screen or component, as the rest of the app does.

---

## Cross-Cutting Behaviors

### Locked pairs

Two players can be "locked" together for the session (`playerStore.lockPlayers`/`unlockPlayer`, `Player.lockedPartnerId`). This is a **session-scoped pairing preference**, independent of quorums and independent of which team they're on. It is enforced almost everywhere in `stackStore.ts` (see above) and gates the Players screen's Lock Pair action against group mismatches and quorum membership. Locking two players breaks either one's existing pairing first — a player can only be locked to one partner at a time.

### Quorums

A quorum is a _stronger_, all-4 commitment ("these exact 4 people play together this round") layered on top of locked pairs — see `utils/quorum.ts` above. Quorums are created from either the Stack screen (mark an existing full stack) or the Players screen (select exactly 4 and create). They auto-reassemble via `checkQuorumsForPlayers` whenever members stop `"Playing"`, but are dissolved for good the moment their game ends (one-shot).

### Multi-group stacking

When `settingsStore.multiGroupStack` is on, the app maintains **separate beginner/advanced queues** end-to-end: the Stack screen renders two (or three, with Unsorted) independent columns instead of one grid; `addToQueue`/`addManyToQueue`/`addPlayersToTypeQueue`/`autoFillQueue` all restrict matches to same-group stacks; the Players screen's add-to-stack and lock-pair flows respect group boundaries too. Turning it off collapses everything back to one undifferentiated queue — group is simply ignored, not migrated/cleaned up (existing group-segregated stacks just stop being treated specially).

### Landscape & columns

`isLandscape = width > height` (`useWindowDimensions`). Court, Players, single-group Stack, and their guest read-only mirrors (`GuestCourtView`/`GuestStackView`) get their column count from `hooks/useResponsiveColumns.ts`, not the raw setting directly: `numColumns = isLandscape && !isSmallDevice ? landscapeColumns : 1`, where `isSmallDevice` is `Math.min(width, height) < 600` — Android's own `sw600dp` tablet-qualifier threshold, checked against the shorter dimension so it's stable across rotation. This means the `landscapeColumns` setting (1–3) only actually takes effect on tablet-sized devices; a phone always gets 1 column regardless of the setting, since 2-3 columns truncates `CourtCard`/`PlayerCard`/`StackCard` content at phone widths. An uneven last row is padded with invisible spacer items; the `FlatList` is keyed by `numColumns` (RN requires remounting to change column count). Multi-group Stack mode ignores all of this entirely (always 2 fixed side-by-side columns, unaffected by device size). Dialogs (`AlertDialog`, `ConfirmDialog`, `CourtFormModal`) constrain themselves to 50% width, centered, in landscape. `CourtCard`/`StackCard` player rows also switch on `useIsSmallDevice()`: on phones the avatar + name take a full row and the rating/last-played/lock indicators drop to a second row (so names don't truncate); tablets keep the original inline layout.

### Session Sync (host/guest live viewing)

One device can **host** a session so others can passively **watch** the Court and Stack screens live, with no user accounts — auth is a shared secret, not identity.

- **Identification**: a 6-char public code (`utils/sessionCode.ts`, e.g. `A7K3PX`), shown as text and as a QR (`react-native-qrcode-svg`) in `SessionSyncSection`. Guests join by scanning (`expo-camera`) or typing the code into `JoinSessionModal`.
- **Authorization**: only the host holds a `host_key` (minted client-side, persisted locally). All writes to the Supabase `sessions` row go through `SECURITY DEFINER` RPCs (`create_session` / `update_session_state` / `end_session`) that check `host_key` matches; anon RLS only grants `SELECT`. Guests never see the host key.
- **Transport** (`utils/sessionSync.ts`): a Supabase Realtime channel per session (`session-<code>`) carries `broadcast` state pushes and `presence` (guest list) — no table replication needs enabling in the Supabase dashboard. The `sessions.state` column is the durable snapshot a late-joining guest fetches on join; broadcasts are what keep already-connected guests live (~400ms debounced).
- **What syncs**: `SessionSnapshot` = `courts` + `stacks` + `players` + `pinnedStackId` (from `stackStore`) + `quorums` + `multiGroupStack` — everything Court/Stack need to render faithfully, including the host's queue-layout setting (a guest must see the same Beginner/Advanced split the host is running, not their own local default). `landscapeColumns` and `teamStore` stay **local per device** on both host and guest — those are genuinely per-viewer display preferences, not game state.
- **Host push**: `startHostSync` subscribes to `courtStore`/`stackStore`/`playerStore`/`quorumStore`/`settingsStore` and re-pushes the full snapshot (debounced) on any change, via both an `update_session_state` RPC call (durability) and a `broadcast` (low latency).
- **Guest render**: a **separate read-only layer**, not a takeover of the guest's own local stores — `sessionStore.remoteSnapshot` feeds `GuestCourtView`/`GuestStackView`, so a guest's own standalone roster/queue (if they use the app independently) is never touched. `CourtCard`/`StackCard` accept a `readOnly` prop that hides the ⋮ menu, END GAME, and Move to Court controls entirely (not just disabled) when set.
- **Guest tab bar**: `app/(tabs)/_layout.tsx` sets `href: null` on the `player`/`settings` tab screens whenever `sessionStore.role === "guest"`, so Players/Settings drop out of the tab bar entirely. A guest's only way out of a session is the "Leave" control in `GuestSessionBanner`, rendered atop the Court/Stack screens.
- **Ending a session**: host's "Stop Hosting" broadcasts a `session_ended` event before deleting the row; guests show an alert and auto-leave. `rehydrateConnection()` (called once from `app/_layout.tsx`) re-opens the channel for a persisted role/session after an app relaunch, so killing the host or guest app mid-session doesn't end it.
- **Setup**: needs `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (see `.env.example`) and `supabase/schema.sql` (the `sessions` table + RLS policy + the three RPCs) applied in the Supabase project's SQL editor. The script is idempotent — safe to re-run after schema changes.

---

## Styling — read this before changing colors

Three overlapping sources of color exist; **know which one you're touching**:

1. **`theme/index.ts`** (`lightTheme`, a `MD3LightTheme` override) — the real, live design tokens, consumed via React Native Paper's `useTheme()`. This is what almost every component actually styles itself with (`theme.colors.primary`, `.error`, `.surface`, etc.), via inline `style={{...}}`.
2. **`tailwind.config.js`** — a second, independently-maintained copy of the same green palette exposed as NativeWind classNames (`bg-primary`, `bg-app-bg`, ...). Only used for a handful of layout/spacing className usages (screen root containers, a few flex-row/gap combos); **numerically matches** `theme/index.ts` today but is not generated from it — **if you change the brand color, update both files**.
3. **Ad hoc hardcoded hex literals**, local to individual components — team colors (Team 1 `#DC2626` red / Team 2 `#1D4ED8` blue, consistent across `CourtCard`, `StackCard`, `NextStackPromptDialog`, `MoveToStackDialog`, but **not** `WinnerDialog`, which instead uses `theme.colors.primary`/`secondary`), `PlayerCard`'s per-status badge colors (`STATUS_CONFIG`), quorum indigo (`#E0E7FF`/`#3730A3`), "Up Next"/"Pinned" oranges/yellows, and `PlayerStandingsDialog`'s medal golds/silvers/bronzes. These are not centralized — adding a new status/badge color means picking a new local hex, matching the existing style.

`constants/Colors.ts` and `components/Themed.tsx`/`useColorScheme*.ts` are **legacy Expo-template scaffolding**, not the app's real theme — they're only reachable through the dead `app/modal.tsx` screen. Don't theme new features off of them.

**Convention**: NativeWind `className` for coarse layout/spacing; inline `style={{ color: theme.colors.x }}` for anything color- or state-dependent. This split is intentional in the existing code — follow it rather than picking one exclusively.

### Green palette (Paper MD3 tokens, `theme/index.ts`)

| Token                | Value     |
| -------------------- | --------- |
| `primary`            | `#2D6A4F` |
| `onPrimary`          | `#FFFFFF` |
| `primaryContainer`   | `#B7DFCA` |
| `onPrimaryContainer` | `#002114` |
| `secondary`          | `#52B788` |
| `onSecondary`        | `#FFFFFF` |
| `secondaryContainer` | `#D8F3E3` |
| `background`         | `#F4FCF5` |
| `onBackground`       | `#1A1C1A` |
| `surface`            | `#FFFFFF` |
| `surfaceVariant`     | `#DCE5DC` |
| `outline`            | `#717971` |
| `outlineVariant`     | `#C1CAC1` |
| `error`              | `#BA1A1A` |
| `errorContainer`     | `#FFDAD6` |

(All other MD3 tokens — tertiary, inverse\*, elevation, etc. — are inherited unmodified from Paper's default `MD3LightTheme`.)

---

## Coding Conventions

1. **Path alias** — always `@/` for project imports (`import { Court } from '@/types'`), never deep relative paths.
2. **Types** — define all shared types in `types/index.ts`; never duplicate locally.
3. **Mutations** — never mutate Zustand state outside an action; use Immer drafts inside `set()`. When a lookup and its mutation must be atomic (e.g. "find the first stack with room, then fill it"), do both inside the same `set()` call — see `addPlayersToTypeQueue`/`processGameResult` for the pattern, and their comments on why (stale-draft bugs otherwise).
4. **Cross-store reads** — use `useXStore.getState()` from inside another store's action or from `utils/`; don't try to pass store data as function params through several layers.
5. **IDs** — `` `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}` ``, generated locally per store (not a shared util currently — keep consistent if you add a new store).
6. **Styling** — see the "Styling" section above: NativeWind `className` for layout, `theme.colors.*` inline styles for anything color/state-dependent.
7. **Components** — keep components focused; pass only required props; use callbacks for actions. Bottom-sheet action menus should reuse `ActionBottomSheet`/`OptionPickerSheet` rather than building a new one.
8. **File naming** — PascalCase for components/screens, camelCase for stores and utilities.
9. **Layout awareness** — always detect orientation with `useWindowDimensions()` when building a new list/grid screen; follow the `isLandscape`/`numColumns`/spacer pattern already used by Court/Player/Stack screens (see "Landscape & columns").
10. **Component extraction** — when a JSX block is large or self-contained (modal, dialog, bottom sheet, form), extract it into its own file under the matching `components/` subdirectory rather than inlining it in a screen.
11. **`Dialog.Actions` children** — Paper clones each direct child with a `compact` prop, so never wrap conditional buttons in a `<>` Fragment there (React warns "Invalid prop `compact` supplied to `React.Fragment`"). Render a keyed array (`cond && [<Button key="a" />, <Button key="b" />]`) or individual conditionals instead.
12. **Locked-pair / quorum awareness** — any new stack-mutating action should account for `lockedPartnerId` (keep pairs together, same team, never split across stacks) and should avoid disturbing a quorum's stack; check how `stackStore.ts`'s existing actions handle both before adding a new one.

---

## Known Rough Edges (worth knowing before you touch nearby code)

- `app/(tabs)/stack.tsx` computes `waitingPlayers`/`readyCount` but doesn't render them anywhere in the current JSX — likely leftover from a removed header stat display.
- `StackCard.tsx`'s `formatElapsed` duplicates `utils/time.ts`'s `formatLastPlayed` with slightly different output formatting — consolidate if you touch either.
- `WinnerDialog.tsx` uses `theme.colors.primary`/`secondary` for its two team buttons instead of the red/blue team-color convention every other team-facing component uses.
- Tailwind's color tokens and the Paper theme's tokens are two separately maintained files that happen to agree today — see "Styling" above.

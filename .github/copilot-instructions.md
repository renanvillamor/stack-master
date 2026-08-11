# StackMaster – GitHub Copilot Instructions

## Project Overview

**StackMaster** is an Expo React Native app that helps manage pickleball stacking —
organising players into courts with two teams of two for each game.

---

## Tech Stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| Framework     | Expo SDK (React Native)                                         |
| Navigation    | Expo Router v5 — file-based bottom tabs                         |
| UI Components | React Native Paper (Material Design 3)                          |
| Styling       | NativeWind v4 (TailwindCSS utility classes)                     |
| State / Store | Zustand v5 + Immer middleware                                   |
| Persistence   | Zustand `persist` + `@react-native-async-storage/async-storage` |
| Language      | TypeScript (strict)                                             |

---

## Project Structure

```
app/
  _layout.tsx          # Root layout — PaperProvider, SafeAreaProvider, NativeWind CSS
  (tabs)/
    _layout.tsx        # Bottom tab navigator (4 tabs)
    court.tsx          # Court management screen
    stack.tsx          # Stack management screen
    player.tsx         # Player management screen
    settings.tsx       # Settings screen

components/
  common/
    ConfirmDialog.tsx  # Reusable confirmation dialog
  court/
    CourtCard.tsx      # Court list item
    CourtFormModal.tsx # Add / edit court modal
  player/
    PlayerCard.tsx     # Player list item with level & status chips
    PlayerFormModal.tsx# Add / edit player modal
  stack/
    StackCard.tsx      # Stack card showing two teams

store/
  courtStore.ts        # Courts CRUD
  playerStore.ts       # Players CRUD + status + game tracking
  stackStore.ts        # Stack queue management
  settingsStore.ts     # App configuration

types/
  index.ts             # All shared TypeScript interfaces and types

theme/
  index.ts             # React Native Paper MD3 light & dark green themes

global.css             # Tailwind base / components / utilities
tailwind.config.js     # NativeWind preset + custom green colour palette
babel.config.js        # NativeWind babel transform
metro.config.js        # NativeWind metro bundler integration
```

---

## Data Models

### Court

```typescript
interface Court {
  id: string;
  name: string;
}
```

### Player

```typescript
type PlayerLevel = "Beginner" | "Intermediate" | "Advanced";
type PlayerStatus = "Available" | "Playing" | "Inactive";

interface Player {
  id: string;
  name: string;
  level: PlayerLevel;
  status: PlayerStatus;
  matches: number;
  lastPlayed: string | null; // ISO date string
}
```

### Stack

```typescript
interface Team {
  playerIds: string[];
} // max 2 players
interface Stack {
  id: string;
  courtId: string | null;
  team1: Team;
  team2: Team; // 4 players total = Ready
  createdAt: string;
}
```

### Settings

```typescript
interface Settings {
  shuffleWinners: boolean;
  shuffleLosers: boolean;
}
```

---

## Store Pattern

All stores follow the same pattern — `persist` wraps `immer`:

```typescript
export const useXxxStore = create<XxxState>()(
  persist(
    immer((set, get) => ({
      // state fields
      // action methods using Immer draft mutations
    })),
    { name: "xxx-storage", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
```

---

## Coding Conventions

1. **Path alias** – always use `@/` for project imports (e.g. `import { Court } from '@/types'`).
2. **Styling** – use NativeWind `className` for layout/spacing; use `useTheme()` from
   React Native Paper for semantic colours (e.g. `theme.colors.primary`).
3. **Types** – define all shared types in `types/index.ts`; never duplicate locally.
4. **Mutations** – never mutate Zustand state outside an action; use Immer drafts inside `set()`.
5. **Components** – keep components focused; pass only required props; use callbacks for actions.
6. **IDs** – generated with `Date.now().toString(36) + Math.random().toString(36).slice(2,9)`.
7. **File naming** – PascalCase for components/screens, camelCase for stores and utilities.
8. **Layout awareness** – always detect orientation with `useWindowDimensions()`. In landscape
   (`width > height`), modals and dialogs must be constrained to **50% width** and centred
   (`alignSelf: 'center', width: '50%'` on the container / `style` prop of the Dialog).
9. **Component extraction** – when a JSX block is large or self-contained (e.g. a modal, dialog,
   bottom sheet, or form), extract it into its own component file under the appropriate
   `components/` subdirectory rather than inlining it in a screen.

---

## Green Colour Palette (MD3)

| Token              | Light     | Dark      |
| ------------------ | --------- | --------- |
| `primary`          | `#2D6A4F` | `#74C69D` |
| `secondary`        | `#52B788` | `#95D5B2` |
| `background`       | `#F4FCF5` | `#1A1C1A` |
| `primaryContainer` | `#B7DFCA` | `#1B5E20` |

---

## Feature Summary

| Tab          | Description                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| **Court**    | Add / edit / remove courts by name                                                    |
| **Stack**    | View current game queues (2 teams × 2 players); remove individual stacks or clear all |
| **Player**   | Add / edit / remove players; add available players to the stack queue                 |
| **Settings** | Toggle shuffle-winners and shuffle-losers behaviours                                  |

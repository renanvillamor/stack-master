import { test as base, expect, Page, Locator } from "@playwright/test";

/**
 * react-native-paper components with a dynamic `testID` (Card, IconButton,
 * Button, ...) also stamp `${testID}-container`/`-outline`/`-icon-container`/
 * `-text` etc. on internal wrapper/decoration elements — a plain
 * `[data-testid^="prefix-"]` prefix selector matches those too, since they
 * also start with the same prefix. This builds a selector for "starts with
 * `prefix`, and isn't one of Paper's own decorative suffixes" so dynamic,
 * id-keyed testIDs (e.g. `court-card-${court.id}`) resolve to exactly the
 * one real element.
 */
const PAPER_DECORATIVE_SUFFIXES = ["-container", "-outline", "-icon-container", "-text"];
export function byIdPrefix(prefix: string): string {
  const excludes = PAPER_DECORATIVE_SUFFIXES.map((s) => `:not([data-testid$="${s}"])`).join("");
  return `[data-testid^="${prefix}"]${excludes}`;
}

/**
 * Every generated id (courts, players, stacks — see each store's `uid()`)
 * is `${base36 timestamp}-${7-char base36 random}`, i.e. exactly one
 * hyphen, alphanumeric only. A card's root testID is `${prefix}${id}` with
 * nothing else appended — but several of that same card's *children* are
 * also testID'd as `${prefix}menu-${id}`, `${prefix}player-${id}`, etc.,
 * which also happen to start with the same `prefix` string. Anchoring the
 * id shape excludes those child widgets, unlike a plain `^=` prefix match.
 */
export function cardRootByPrefix(page: Page, prefix: string) {
  return page.getByTestId(new RegExp(`^${prefix}[0-9a-z]+-[0-9a-z]+$`));
}

/** Filters a locator down to the one element whose *own* rendered text is exactly `text` (not a substring match, which can false-positive — e.g. player "Eve" is a substring of the "Never" last-played label). */
export function withExactText(locator: Locator, page: Page, text: string) {
  return locator.filter({ has: page.getByText(text, { exact: true }) });
}

/**
 * Every store is Zustand `persist` backed by AsyncStorage, which resolves to
 * `window.localStorage` on web (see store/*.ts — keys are `court-storage`,
 * `player-storage`, `quorum-storage`, `settings-storage`, `stack-storage`,
 * `team-storage`). Clearing it and reloading is the full app reset — there's
 * no server-side state to worry about.
 */
export async function resetApp(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("court-add-fab")).toBeVisible();
  // Expo web server-renders the initial HTML, so the FAB is in the DOM
  // (and passes the visibility check above) before React finishes
  // hydrating and attaching its click handler — a click issued in that
  // window is silently lost. Wait for hydration to actually settle before
  // handing the page back to a test.
  await expect(async () => {
    await page.getByTestId("court-add-fab").click();
    await expect(page.getByTestId("court-form-modal")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000, intervals: [250, 500, 1000] });
  await page.getByTestId("court-form-cancel").click();
  await expect(page.getByTestId("court-form-modal")).toBeHidden();
}

export const test = base.extend<{ freshApp: Page }>({
  freshApp: async ({ page }, use) => {
    await resetApp(page);
    await use(page);
  },
});

export { expect };

// ─── Navigation ──────────────────────────────────────────────────────────

export async function goToCourtTab(page: Page) {
  await page.getByRole("tab", { name: "Court" }).click();
  await expect(page.getByTestId("court-add-fab")).toBeVisible();
}

export async function goToStackTab(page: Page) {
  await page.getByRole("tab", { name: "Stack" }).click();
}

export async function goToPlayerTab(page: Page) {
  await page.getByRole("tab", { name: "Players" }).click();
  await expect(page.getByTestId("player-add-fab")).toBeVisible();
}

export async function goToSettingsTab(page: Page) {
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByTestId("settings-multigroup-switch")).toBeVisible();
}

// ─── Players ─────────────────────────────────────────────────────────────

/** Adds one player via the Players tab form. Ratings must be one of PlayerFormModal's RATING_OPTIONS ("NR" or 2.0-5.0 in 0.1 steps). */
export async function addPlayer(
  page: Page,
  name: string,
  rating: string = "NR",
) {
  await goToPlayerTab(page);
  await page.getByTestId("player-add-fab").click();
  await expect(page.getByTestId("player-form-modal")).toBeVisible();
  await page.getByTestId("player-form-name-input").fill(name);
  await page.getByTestId(`player-form-rating-${rating}`).click();
  await page.getByTestId("player-form-submit").click();
  await expect(page.getByTestId("player-form-modal")).toBeHidden();
}

/** Adds several players in one comma-separated submission (all get the same rating), per PlayerFormModal's multi-add behavior. */
export async function addPlayersBulk(
  page: Page,
  names: string[],
  rating: string = "NR",
) {
  await goToPlayerTab(page);
  await page.getByTestId("player-add-fab").click();
  await expect(page.getByTestId("player-form-modal")).toBeVisible();
  await page.getByTestId("player-form-name-input").fill(names.join(", "));
  await page.getByTestId(`player-form-rating-${rating}`).click();
  await page.getByTestId("player-form-submit").click();
  await expect(page.getByTestId("player-form-modal")).toBeHidden();
}

export function playerCards(page: Page) {
  return cardRootByPrefix(page, "player-card-");
}

export function playerCard(page: Page, name: string) {
  return withExactText(playerCards(page), page, name);
}

/** Opens the per-player action sheet for a player by name (tap-to-open, only valid outside selection mode). */
export async function openPlayerActions(page: Page, name: string) {
  await playerCard(page, name).click();
}

/** Queues a single Available player from the Players tab (assumes at most one fitting stack, so no picker appears). */
export async function addToStackFromPlayerTab(page: Page, name: string) {
  await openPlayerActions(page, name);
  await page.getByTestId("player-action-add-to-stack").click();
  await waitForNoBottomSheet(page);
}

/** Long-presses a player card to enter multi-select mode with that player pre-selected. Playwright has no native long-press, so this dispatches pointerdown/wait/pointerup on the card. */
export async function longPressPlayerCard(page: Page, name: string) {
  const card = playerCard(page, name);
  const box = await card.boundingBox();
  if (!box) throw new Error(`player card "${name}" not found`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
}

/**
 * Toggles a player card's selection during multi-select mode, tolerating a
 * known one-off quirk: the very first tap on a *different* card right after
 * a long-press can be silently swallowed (the screen's onLongPress/onPress
 * disambiguation flag is armed expecting the long-pressed card's own
 * trailing click to consume it; if the web Pressable never fires that
 * trailing click, the flag stays armed and eats the next real tap instead).
 * Retries the click if the expected selection count doesn't show up.
 */
export async function selectCard(page: Page, name: string, expectedCount: number) {
  await expect(async () => {
    if (await page.getByText(`${expectedCount} selected`).isVisible()) return;
    await playerCard(page, name).click();
    await expect(page.getByText(`${expectedCount} selected`)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 5000 });
}

/** Long-presses the first player to enter multi-select, then taps the rest — leaves the bulk action sheet closed and all `names` selected. */
export async function selectPlayers(page: Page, names: string[]) {
  await longPressPlayerCard(page, names[0]);
  await expect(page.getByText("1 selected")).toBeVisible();
  for (let i = 1; i < names.length; i++) {
    await selectCard(page, names[i], i + 1);
  }
}

/** Opens the bulk-selection action sheet (must already be in selection mode) and clicks the item with the given testID. Waits for the sheet to fully close before returning, so the next interaction (e.g. a long-press) can't land on its still-animating backdrop. */
export async function bulkAction(page: Page, testId: string) {
  await page.getByTestId("player-selection-manage").click();
  await page.getByTestId(testId).click();
  await waitForNoBottomSheet(page);
}

/** Selects exactly two players and locks them via the bulk "Lock Pair" action. */
export async function lockPair(page: Page, nameA: string, nameB: string) {
  await goToPlayerTab(page);
  await selectPlayers(page, [nameA, nameB]);
  await bulkAction(page, "player-bulk-action-lock-pair");
}

// ─── Courts ──────────────────────────────────────────────────────────────

export async function addCourt(page: Page, name: string) {
  await goToCourtTab(page);
  await page.getByTestId("court-add-fab").click();
  await expect(page.getByTestId("court-form-modal")).toBeVisible();
  await page.getByTestId("court-form-name-input").fill(name);
  await page.getByTestId("court-form-submit").click();
  await expect(page.getByTestId("court-form-modal")).toBeHidden();
}

export function courtCard(page: Page, name: string) {
  return withExactText(cardRootByPrefix(page, "court-card-"), page, name);
}

/** Opens a court card's "⋮" menu (its testID is keyed by court id, not name, so this scopes by the card's visible name text first). */
export async function openCourtMenu(page: Page, name: string) {
  await courtCard(page, name).locator(byIdPrefix("court-card-menu-")).click();
}

export function courtEndGameButton(page: Page, name: string) {
  return courtCard(page, name).locator(byIdPrefix("court-card-end-game-"));
}

/** A player row inside a court's active game, by player name (tap to switch team). */
export function courtCardPlayerRow(page: Page, card: Locator, name: string) {
  return withExactText(card.locator(byIdPrefix("court-card-player-")), page, name);
}

/**
 * Ends the active game on a court by choosing the winning team in the
 * WinnerDialog. Ending a game re-checks the next queued stack and may pop a
 * follow-up dialog about it (ready to move to the freed court, or still
 * short of players) — this dismisses whichever one (if either) appears via
 * its backdrop, which just closes the dialog without moving/completing
 * anything, so callers don't have to special-case it.
 */
export async function endGame(page: Page, courtName: string, winningTeam: 1 | 2) {
  await courtEndGameButton(page, courtName).click();
  const winnerButton = page.getByTestId(`winner-dialog-team${winningTeam}`);
  await expect(winnerButton).toBeVisible();
  await winnerButton.click();

  const followUpBackdrop = page.getByTestId(
    /^(incomplete-stack-prompt|next-stack-prompt)-backdrop$/,
  );
  try {
    await expect(followUpBackdrop.first()).toBeVisible({ timeout: 2000 });
  } catch {
    return;
  }
  // The backdrop covers the full viewport, but its default (bounding-box
  // center) click point can fall behind the dialog's own surface — see
  // dismissBottomSheet for the same issue with gorhom's bottom sheet. A
  // corner near the top is always clear of the centered dialog card.
  await followUpBackdrop.first().click({ position: { x: 10, y: 10 } });
  await expect(followUpBackdrop.first()).toHaveCount(0);
}

// ─── Stacks ──────────────────────────────────────────────────────────────

export function stackCards(page: Page) {
  return cardRootByPrefix(page, "stack-card-");
}

/** A queued stack card containing all of the given player names (order-independent). */
export function stackCardWithPlayers(page: Page, names: string[]) {
  let locator = stackCards(page);
  for (const name of names) {
    locator = withExactText(locator, page, name);
  }
  return locator;
}

export async function openStackMenu(page: Page, card: Locator) {
  await card.locator(byIdPrefix("stack-card-menu-")).click();
}

export function stackMoveToCourtButton(card: Locator) {
  return card.locator(byIdPrefix("stack-card-move-to-court-"));
}

/** A player row inside a stack card, by player name (tap to switch team / move / remove). */
export function stackCardPlayerRow(page: Page, card: Locator, name: string) {
  return withExactText(card.locator(byIdPrefix("stack-card-player-")), page, name);
}

/** A target stack card inside the MoveToStackDialog containing all of the given player names (order-independent). */
export function moveToStackDialogCard(page: Page, names: string[]) {
  let locator = cardRootByPrefix(page, "move-to-stack-item-");
  for (const name of names) {
    locator = withExactText(locator, page, name);
  }
  return locator;
}

/** A player row inside a MoveToStackDialog target card, by player name — tap to swap the moving player in for that player when the target stack is full. */
export function moveToStackDialogPlayerRow(page: Page, card: Locator, name: string) {
  return withExactText(card.locator(byIdPrefix("move-to-stack-player-")), page, name);
}

// ─── Settings ────────────────────────────────────────────────────────────

/**
 * RN Web's <Switch> puts `testID` on the outer wrapper div, not the real
 * `<input type="checkbox" role="switch">` it overlays — `.click()` on the
 * wrapper works (the input visually/positionally covers it), but
 * `.isChecked()`/`.check()`/`.uncheck()` require the actual input element.
 */
export function switchInput(page: Page, testId: string) {
  return page.getByTestId(testId).locator("input");
}

/** Multi-group stacking defaults on; several stack/queue flows are simpler to assert against a single flat queue. */
export async function setMultiGroupStacking(page: Page, enabled: boolean) {
  await goToSettingsTab(page);
  const input = switchInput(page, "settings-multigroup-switch");
  if ((await input.isChecked()) !== enabled) {
    await input.click();
  }
}

/**
 * Shuffle Players defaults on ("split winners & losers onto opposite teams"
 * on game end). Unlike the multigroup switch, this one is nested inside a
 * `List.Item`'s `right` slot — clicking straight through to its inner
 * `<input>` (as `setMultiGroupStacking` does for the un-nested multigroup
 * switch) can land while List.Item's own touchable is still intercepting
 * the click, so this clicks the outer testID wrapper instead, same as
 * 06-settings.spec.ts already does successfully.
 */
export async function setShufflePlayers(page: Page, enabled: boolean) {
  await goToSettingsTab(page);
  const input = switchInput(page, "settings-shuffle-switch");
  if ((await input.isChecked()) !== enabled) {
    await page.getByTestId("settings-shuffle-switch").click();
  }
}

// ─── Bottom sheets ───────────────────────────────────────────────────────

/**
 * ActionBottomSheet/OptionPickerSheet "switch" rows toggle in place instead
 * of dismissing (so the sheet stays open — see ActionBottomSheet.tsx). This
 * closes it by clicking gorhom's full-screen backdrop (pressBehavior="close")
 * in a corner unlikely to overlap any real control.
 */
export async function dismissBottomSheet(page: Page) {
  // The backdrop covers the full viewport, but its default (bounding-box
  // center) click point can fall behind the sheet's own panel, which is
  // layered on top of the backdrop over the bottom portion of the screen.
  // A corner near the top is always clear of the panel.
  await page
    .getByRole("button", { name: "Bottom sheet backdrop" })
    .click({ position: { x: 10, y: 10 } });
  await waitForNoBottomSheet(page);
}

/**
 * Clicking an ActionBottomSheet "button"-type item calls `dismiss()` and the
 * item's `onPress` in the same handler, but gorhom's BottomSheetModal only
 * actually unmounts (and its full-screen backdrop stops intercepting clicks)
 * once its close animation finishes — a few hundred ms later. A test that
 * immediately does something else (e.g. switches tabs) can race that
 * animation and get its click swallowed by the still-present backdrop. Wait
 * for it to be gone before moving on.
 */
export async function waitForNoBottomSheet(page: Page) {
  // The sheet's own "handle" (role=slider) can linger, inert, in the DOM
  // after closing without unmounting — the backdrop (role=button) is what
  // actually intercepts clicks, and only an *actively open* sheet renders
  // one, so its absence is the reliable "nothing is blocking input" signal.
  await expect(page.getByRole("button", { name: "Bottom sheet backdrop" })).toHaveCount(0);
}

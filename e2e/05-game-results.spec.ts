import { test, expect } from "./fixtures";
import {
  addCourt,
  addPlayersBulk,
  addToStackFromPlayerTab,
  bulkAction,
  byIdPrefix,
  endGame,
  goToCourtTab,
  goToPlayerTab,
  goToStackTab,
  lockPair,
  openPlayerActions,
  resetApp,
  selectPlayers,
  setMultiGroupStacking,
  setShufflePlayers,
  stackCardWithPlayers,
  stackMoveToCourtButton,
  waitForNoBottomSheet,
} from "./fixtures";

test.describe("Court screen — game results routing", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    // A single flat queue keeps the winners-stack assertions below simple —
    // multi-group stacking would additionally split them by rating.
    await setMultiGroupStacking(page, false);
    await addCourt(page, "Court 1");
  });

  test("splitting winners tops off an existing incomplete Winner Stack instead of always starting a new one", async ({
    page,
  }) => {
    // Regression test for: ending a game with Shuffle Players on (the
    // default) used to always spin up a brand-new Winner Stack for a split
    // pair, even when an existing Winner Stack still had an open seat —
    // leaving that stack incomplete forever instead of being topped off.

    await addPlayersBulk(page, ["W1", "W2", "L1", "L2", "W3", "P1", "P2", "P3", "P4"]);

    // Game 1: a locked pair (W1, W2) wins, landing together as a Winner
    // Stack's team1 — locked pairs always stay together regardless of
    // shuffle, so this deterministically leaves that stack with team1 full
    // and team2 empty.
    await lockPair(page, "W1", "W2");
    await addToStackFromPlayerTab(page, "W1");
    await addToStackFromPlayerTab(page, "W2"); // joins W1 (locked partner)
    await addToStackFromPlayerTab(page, "L1");
    await addToStackFromPlayerTab(page, "L2");

    await goToStackTab(page);
    const game1Stack = stackCardWithPlayers(page, ["W1", "W2", "L1", "L2"]);
    await stackMoveToCourtButton(game1Stack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = W1, W2 (the locked pair)

    // Top off the Winner Stack to exactly 3/4 players — one seat short — by
    // adding a third, unrelated player to it. Both the (2/4) Winner Stack
    // and the (2/4) Loser Stack from game 1 have room, so "Add to Stack"
    // opens a picker instead of auto-joining one — pick the Winner Stack.
    await goToPlayerTab(page);
    await openPlayerActions(page, "W3");
    await page.getByTestId("player-action-add-to-stack").click();
    await waitForNoBottomSheet(page);
    await expect(page.getByTestId("player-stack-picker-dialog")).toBeVisible();
    await page
      .locator(byIdPrefix("player-stack-picker-item-"))
      .filter({ hasText: "W1" })
      .click();
    await expect(page.getByTestId("player-stack-picker-dialog")).toBeHidden();

    await goToStackTab(page);
    await expect(stackCardWithPlayers(page, ["W1", "W2", "W3"])).toBeVisible();

    // Game 2: P1 & P2 (not locked) win a normal 2v2 — the scenario from the
    // bug report. Queued as one bulk action rather than one at a time:
    // "Add to Stack" considers stacks of any type, and the still-incomplete
    // Winner/Loser stacks from game 1 have room for 1-2 more each, which
    // would otherwise pop the "choose a stack" picker for a single add. A
    // batch of 4 doesn't fit either of those, so it goes straight to a
    // fresh stack.
    await goToPlayerTab(page);
    await selectPlayers(page, ["P1", "P2", "P3", "P4"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const game2Stack = stackCardWithPlayers(page, ["P1", "P2", "P3", "P4"]);
    await stackMoveToCourtButton(game2Stack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = P1, P2

    // Expected: P1 tops off the existing (now 3/4) Winner Stack to Ready,
    // and only P2 — the one with nowhere existing to go — starts a new one.
    await goToStackTab(page);
    const toppedOffStack = stackCardWithPlayers(page, ["W1", "W2", "W3", "P1"]);
    await expect(toppedOffStack).toBeVisible();
    await expect(toppedOffStack.getByText("Ready")).toBeVisible();

    const newWinnerStack = stackCardWithPlayers(page, ["P2"]);
    await expect(newWinnerStack).toBeVisible();
    await expect(newWinnerStack.getByText("Winners")).toBeVisible();
  });

  test("shuffle doesn't reunite fresh winners as teammates when topping off a stack that's full on one team", async ({
    page,
  }) => {
    // Regression test for: an existing Winner Stack already holds a locked
    // pair as a full team (room only on its OTHER team). When a fresh,
    // unrelated pair then wins with Shuffle Players on, the "top off one
    // team at a time" fallback used to add both winners into that same open
    // team one after another — silently reuniting them as teammates, which
    // defeats shuffle's whole purpose (they'd just been teammates on court).
    await addPlayersBulk(page, ["P1", "P2", "Y1", "Y2", "P3", "P4", "P5", "P6"]);
    await lockPair(page, "P1", "P2");

    // Game 1: locked pair P1/P2 vs Y1/Y2 — P1/P2 win and land together in a
    // brand-new Winner Stack (locked pairs always stay teammates regardless
    // of shuffle), leaving that stack's team1 full and team2 empty.
    await addToStackFromPlayerTab(page, "P1");
    await addToStackFromPlayerTab(page, "P2"); // joins P1 (locked partner)
    await addToStackFromPlayerTab(page, "Y1");
    await addToStackFromPlayerTab(page, "Y2");

    await goToStackTab(page);
    const game1Stack = stackCardWithPlayers(page, ["P1", "P2", "Y1", "Y2"]);
    await stackMoveToCourtButton(game1Stack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = P1, P2 (the locked pair)

    await goToStackTab(page);
    await expect(stackCardWithPlayers(page, ["P1", "P2"])).toBeVisible();

    // Game 2: P3/P4 (not locked) vs P5/P6 on the now-free Court 1 — the
    // exact scenario from the bug report.
    await goToPlayerTab(page);
    await selectPlayers(page, ["P3", "P4", "P5", "P6"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const game2Stack = stackCardWithPlayers(page, ["P3", "P4", "P5", "P6"]);
    await stackMoveToCourtButton(game2Stack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = P3, P4

    // Expected: P3 tops off the existing Winner Stack (joining P1/P2's open
    // team), while P4 — barred from following P3 into that same stack —
    // starts a different Winner Stack instead.
    await goToStackTab(page);
    await expect(stackCardWithPlayers(page, ["P1", "P2", "P3"])).toBeVisible();
    await expect(stackCardWithPlayers(page, ["P4"])).toBeVisible();

    // The crux of the bug: P3 and P4 must never land together in one stack.
    await expect(stackCardWithPlayers(page, ["P3", "P4"])).toHaveCount(0);
  });

  test("shuffle still splits fresh winners onto opposite teams of the same stack when it has room on both teams", async ({
    page,
  }) => {
    // Double-checks that the fix above didn't touch the primary split path:
    // when an existing Winner Stack genuinely has a free seat on BOTH
    // teams, a fresh unlocked pair should still land together in it, split
    // across teams, exactly as shuffle intends — vacant slots on two
    // different teams of the same stack are still fair game.
    await addPlayersBulk(page, ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]);

    // Game 1: A1/A2 (not locked) vs A3/A4 — A1/A2 win with no existing
    // Winner Stack to top off, so shuffle splits them into a brand-new
    // stack: team1 = A1, team2 = A2 — one free seat on each team.
    await goToPlayerTab(page);
    await selectPlayers(page, ["A1", "A2", "A3", "A4"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const game1Stack = stackCardWithPlayers(page, ["A1", "A2", "A3", "A4"]);
    await stackMoveToCourtButton(game1Stack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = A1, A2

    await goToStackTab(page);
    await expect(stackCardWithPlayers(page, ["A1", "A2"])).toBeVisible();

    // Game 2: B1/B2 (not locked) vs B3/B4 — B1/B2 win and should join the
    // existing Winner Stack, split across its two open seats.
    await goToPlayerTab(page);
    await selectPlayers(page, ["B1", "B2", "B3", "B4"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const game2Stack = stackCardWithPlayers(page, ["B1", "B2", "B3", "B4"]);
    await stackMoveToCourtButton(game2Stack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = B1, B2

    await goToStackTab(page);
    const winnerStack = stackCardWithPlayers(page, ["A1", "A2", "B1", "B2"]);
    await expect(winnerStack).toBeVisible();
    await expect(winnerStack.getByText("Ready")).toBeVisible();
  });

  test("with Shuffle Players off, fresh winners still land together as teammates in the Winner Stack", async ({
    page,
  }) => {
    // Double-checks that turning shuffle off is unaffected by the fix
    // above: winners are still allowed — expected, even — to land together
    // on the SAME team of the same stack when shuffle isn't splitting them.
    await setShufflePlayers(page, false);
    await addPlayersBulk(page, ["C1", "C2", "C3", "C4"]);

    await goToPlayerTab(page);
    await selectPlayers(page, ["C1", "C2", "C3", "C4"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const gameStack = stackCardWithPlayers(page, ["C1", "C2", "C3", "C4"]);
    await stackMoveToCourtButton(gameStack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = C1, C2

    await goToStackTab(page);
    const winnerStack = stackCardWithPlayers(page, ["C1", "C2"]);
    await expect(winnerStack).toBeVisible();
    await expect(winnerStack.getByText("Winners")).toBeVisible();
  });
});

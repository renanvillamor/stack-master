import { test, expect } from "./fixtures";
import {
  addCourt,
  addPlayersBulk,
  bulkAction,
  byIdPrefix,
  endGame,
  goToCourtTab,
  goToPlayerTab,
  goToStackTab,
  lockPair,
  resetApp,
  selectPlayers,
  setMultiGroupStacking,
  setShufflePlayers,
  stackCardWithPlayers,
  stackMoveToCourtButton,
} from "./fixtures";

test.describe("Stack screen — repeat team warning", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await setMultiGroupStacking(page, false);
    // Shuffle off so a winning pair deterministically re-queues together as
    // teammates instead of being split across teams — the exact condition
    // the repeat-team warning is meant to catch.
    await setShufflePlayers(page, false);
    await addCourt(page, "Court 1");
  });

  test("flags a team as a repeat combo when two unlocked players were teammates in their last match", async ({
    page,
  }) => {
    await addPlayersBulk(page, ["A1", "A2", "B1", "B2"]);

    await goToPlayerTab(page);
    await selectPlayers(page, ["A1", "A2", "B1", "B2"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const gameStack = stackCardWithPlayers(page, ["A1", "A2", "B1", "B2"]);
    await stackMoveToCourtButton(gameStack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = A1, A2

    // A1/A2 land together again in the Winner Stack (shuffle off) — having
    // just been teammates in the match that ended, this is a repeat combo
    // the admin should be nudged to break up.
    await goToStackTab(page);
    const winnerStack = stackCardWithPlayers(page, ["A1", "A2"]);
    await expect(winnerStack).toBeVisible();
    await expect(
      winnerStack.locator(byIdPrefix("stack-card-repeat-warning-")),
    ).toBeVisible();
  });

  test("does not flag a locked pair as a repeat combo even after playing together again", async ({
    page,
  }) => {
    await addPlayersBulk(page, ["L1", "L2", "B1", "B2"]);
    await lockPair(page, "L1", "L2");

    await goToPlayerTab(page);
    await selectPlayers(page, ["L1", "L2", "B1", "B2"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const gameStack = stackCardWithPlayers(page, ["L1", "L2", "B1", "B2"]);
    await stackMoveToCourtButton(gameStack).click();

    await goToCourtTab(page);
    await endGame(page, "Court 1", 1); // team1 = L1, L2 (the locked pair)

    // L1/L2 reunite as teammates again — same as the unlocked case above —
    // but locking is a deliberate, persistent pairing choice, not an
    // accidental repeat, so no warning should appear.
    await goToStackTab(page);
    const winnerStack = stackCardWithPlayers(page, ["L1", "L2"]);
    await expect(winnerStack).toBeVisible();
    await expect(
      winnerStack.locator(byIdPrefix("stack-card-repeat-warning-")),
    ).toHaveCount(0);
  });

  test("does not flag a team that's never played together before", async ({
    page,
  }) => {
    await addPlayersBulk(page, ["C1", "C2", "C3", "C4"]);

    await goToPlayerTab(page);
    await selectPlayers(page, ["C1", "C2", "C3", "C4"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    const stack = stackCardWithPlayers(page, ["C1", "C2", "C3", "C4"]);
    await expect(stack).toBeVisible();
    await expect(
      stack.locator(byIdPrefix("stack-card-repeat-warning-")),
    ).toHaveCount(0);
  });
});

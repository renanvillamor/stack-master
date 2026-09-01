import { test, expect, byIdPrefix, withExactText } from "./fixtures";
import {
  addPlayer,
  addPlayersBulk,
  bulkAction,
  dismissBottomSheet,
  goToPlayerTab,
  goToStackTab,
  lockPair,
  openPlayerActions,
  openStackMenu,
  playerCard,
  selectPlayers,
  stackCardPlayerRow,
  stackCards,
  stackCardWithPlayers,
  waitForNoBottomSheet,
} from "./fixtures";
import type { Page, Locator } from "@playwright/test";

/** Queues a single Available player from the Players tab (assumes at most one fitting stack, so no picker appears). */
async function addToStackFromPlayerTab(page: Page, name: string) {
  await openPlayerActions(page, name);
  await page.getByTestId("player-action-add-to-stack").click();
  await waitForNoBottomSheet(page);
}

/** ActionBottomSheet marks disabled rows via `aria-disabled` (they're plain divs, not native form controls, so Playwright's `toBeDisabled()` doesn't recognize them). */
async function expectSheetItemDisabled(locator: Locator, disabled: boolean) {
  if (disabled) {
    await expect(locator).toHaveAttribute("aria-disabled", "true");
  } else {
    await expect(locator).not.toHaveAttribute("aria-disabled", "true");
  }
}

test.describe("Locked pairs", () => {
  test("locks and unlocks a pair via bulk actions", async ({ freshApp: page }) => {
    await addPlayersBulk(page, ["Alice", "Bob"]);
    await lockPair(page, "Alice", "Bob");

    await openPlayerActions(page, "Alice");
    await expect(page.getByTestId("player-action-unlock")).toBeVisible();
    await expect(page.getByText("Unlock Pairing (Bob)")).toBeVisible();
    await dismissBottomSheet(page);

    await openPlayerActions(page, "Bob");
    await expect(page.getByTestId("player-action-unlock")).toBeVisible();
    await expect(page.getByText("Unlock Pairing (Alice)")).toBeVisible();
    await dismissBottomSheet(page);

    // Unlock via the bulk action (re-select the same pair).
    await selectPlayers(page, ["Alice", "Bob"]);
    await bulkAction(page, "player-bulk-action-unlock-pair");

    await openPlayerActions(page, "Alice");
    await expect(page.getByTestId("player-action-unlock")).toHaveCount(0);
    await dismissBottomSheet(page);
  });

  test("blocks locking players from different skill groups when multi-group stacking is on", async ({
    freshApp: page,
  }) => {
    // multiGroupStack defaults to true (settingsStore.ts).
    await addPlayer(page, "Lowly", "2.0"); // beginner (<=2.0)
    await addPlayer(page, "Highly", "3.0"); // advanced (>2.0)
    await lockPair(page, "Lowly", "Highly");

    await expect(page.getByText("Skill Level Mismatch")).toBeVisible();
    await page.getByTestId("alert-dialog-ok").click();

    // A blocked Lock Pair returns early without clearing the selection
    // (see player.tsx's handleLockSelectedPair) — still in selection mode,
    // so exit it before a normal per-player tap opens an action sheet again.
    await page.getByTestId("player-selection-close").click();

    await openPlayerActions(page, "Lowly");
    await expect(page.getByTestId("player-action-unlock")).toHaveCount(0);
    await dismissBottomSheet(page);
  });

  test("blocks locking a player who already belongs to a quorum", async ({ freshApp: page }) => {
    await addPlayersBulk(page, ["Q1", "Q2", "Q3", "Q4", "Outsider"]);
    await selectPlayers(page, ["Q1", "Q2", "Q3", "Q4"]);
    await bulkAction(page, "player-bulk-action-create-quorum");

    await lockPair(page, "Q1", "Outsider");
    await expect(page.getByText("Player in a Quorum")).toBeVisible();
    await page.getByTestId("alert-dialog-ok").click();

    // Same early-return-without-clearing-selection quirk as the group
    // mismatch guard — exit selection mode before a normal tap works again.
    await page.getByTestId("player-selection-close").click();

    await openPlayerActions(page, "Q1");
    await expect(page.getByTestId("player-action-unlock")).toHaveCount(0);
    await dismissBottomSheet(page);
  });

  test("a locked player brings their queued partner along when moved to a stack with room", async ({
    freshApp: page,
  }) => {
    await addPlayersBulk(page, ["Locky1", "Locky2", "Filler1", "Filler2", "Room1", "Room2"]);
    await lockPair(page, "Locky1", "Locky2");

    // Locky1+Locky2 claim a whole team together as a batch of 2.
    await selectPlayers(page, ["Locky1", "Locky2"]);
    await bulkAction(page, "player-bulk-action-add-to-stack");

    // Fillers land on the pair's stack's other team (team1 is full with the
    // pair), topping it out at 4/4 so it can't absorb anyone else.
    await addToStackFromPlayerTab(page, "Filler1");
    await addToStackFromPlayerTab(page, "Filler2");

    // Room1/Room2 have nowhere to go now — they form a fresh second stack,
    // landing on its team1 and leaving team2 (2 seats) free.
    await addToStackFromPlayerTab(page, "Room1");
    await addToStackFromPlayerTab(page, "Room2");

    await goToStackTab(page);
    const lockyStack = stackCardWithPlayers(page, ["Locky1", "Locky2", "Filler1", "Filler2"]);
    const roomStack = stackCardWithPlayers(page, ["Room1", "Room2"]);
    await expect(lockyStack).toBeVisible();
    await expect(roomStack).toBeVisible();

    await stackCardPlayerRow(page, lockyStack, "Locky1").click();
    await page.getByTestId("stack-player-action-move-to-stack").click();
    await expect(page.getByTestId("move-to-stack-dialog")).toBeVisible();
    await withExactText(
      page.locator(byIdPrefix("move-to-stack-item-")),
      page,
      "Room1",
    ).click();

    // Both Locky1 and Locky2 land together in the Room stack, filling it;
    // the original stack keeps just the two fillers.
    const mergedStack = stackCardWithPlayers(page, ["Room1", "Room2", "Locky1", "Locky2"]);
    await expect(mergedStack).toBeVisible();
    await expect(mergedStack.getByText("Ready")).toBeVisible();
    await expect(stackCardWithPlayers(page, ["Filler1", "Filler2"])).toBeVisible();
    await expect(stackCards(page)).toHaveCount(2);
  });
});

test.describe("Quorums", () => {
  test("Create Quorum from the Players screen immediately seats all 4 together", async ({
    freshApp: page,
  }) => {
    await addPlayersBulk(page, ["A1", "A2", "A3", "A4"]);
    await selectPlayers(page, ["A1", "A2", "A3", "A4"]);
    await bulkAction(page, "player-bulk-action-create-quorum");

    await goToStackTab(page);
    await expect(stackCards(page)).toHaveCount(1);
    const card = stackCardWithPlayers(page, ["A1", "A2", "A3", "A4"]);
    await expect(card).toBeVisible();
    await expect(card.getByText("Quorum")).toBeVisible();
    await expect(card.getByText("Ready")).toBeVisible();

    await goToPlayerTab(page);
    for (const name of ["A1", "A2", "A3", "A4"]) {
      await expect(playerCard(page, name).getByText("Stacked")).toBeVisible();
    }
  });

  test("Mark as Quorum tags an existing full stack, only once it's full", async ({
    freshApp: page,
  }) => {
    await addPlayersBulk(page, ["P1", "P2"]);
    await addToStackFromPlayerTab(page, "P1");
    await addToStackFromPlayerTab(page, "P2");

    await goToStackTab(page);
    const partialStack = stackCardWithPlayers(page, ["P1", "P2"]);
    await openStackMenu(page, partialStack);
    await expectSheetItemDisabled(page.getByTestId("stack-action-mark-quorum"), true);
    await dismissBottomSheet(page);

    await addPlayersBulk(page, ["P3", "P4"]);
    await addToStackFromPlayerTab(page, "P3");
    await addToStackFromPlayerTab(page, "P4");

    await goToStackTab(page);
    const fullStack = stackCardWithPlayers(page, ["P1", "P2", "P3", "P4"]);
    await openStackMenu(page, fullStack);
    await page.getByTestId("stack-action-mark-quorum").click();
    await expect(fullStack.getByText("Quorum")).toBeVisible();

    // Menu now offers Remove Quorum instead of Mark as Quorum.
    await openStackMenu(page, fullStack);
    await expect(page.getByTestId("stack-action-remove-quorum")).toBeVisible();
    await expect(page.getByTestId("stack-action-mark-quorum")).toHaveCount(0);
    await page.getByTestId("stack-action-remove-quorum").click();

    await expect(fullStack.getByText("Quorum")).toHaveCount(0);
    // Removing the quorum tag doesn't touch stack membership.
    await expect(fullStack).toBeVisible();
  });

  test("Remove from Quorum from a player's own action sheet dissolves the quorum", async ({
    freshApp: page,
  }) => {
    await addPlayersBulk(page, ["Q1", "Q2", "Q3", "Q4"]);
    await selectPlayers(page, ["Q1", "Q2", "Q3", "Q4"]);
    await bulkAction(page, "player-bulk-action-create-quorum");

    await goToPlayerTab(page);
    await openPlayerActions(page, "Q1");
    await expect(page.getByTestId("player-action-remove-quorum")).toBeVisible();
    await page.getByTestId("player-action-remove-quorum").click();
    await expect(page.getByText("This will remove the quorum for all 4 players.")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    await openPlayerActions(page, "Q1");
    await expect(page.getByTestId("player-action-edit")).toBeVisible(); // sheet fully (re)opened
    await expect(page.getByTestId("player-action-remove-quorum")).toHaveCount(0);
    await dismissBottomSheet(page);
    await waitForNoBottomSheet(page);

    await goToStackTab(page);
    await expect(stackCardWithPlayers(page, ["Q1", "Q2", "Q3", "Q4"]).getByText("Quorum")).toHaveCount(0);
  });

  test("a quorum's stack blocks per-player Move to Stack and Remove from Stack", async ({
    freshApp: page,
  }) => {
    await addPlayersBulk(page, ["Q1", "Q2", "Q3", "Q4"]);
    await selectPlayers(page, ["Q1", "Q2", "Q3", "Q4"]);
    await bulkAction(page, "player-bulk-action-create-quorum");

    await goToStackTab(page);
    const card = stackCardWithPlayers(page, ["Q1", "Q2", "Q3", "Q4"]);
    await stackCardPlayerRow(page, card, "Q1").click();

    await expectSheetItemDisabled(page.getByTestId("stack-player-action-move-to-stack"), true);
    await expectSheetItemDisabled(page.getByTestId("stack-player-action-remove-from-stack"), true);
    await expectSheetItemDisabled(page.getByTestId("stack-player-action-switch-team"), false);
  });

  test("blocks creating a quorum when a member is locked to someone outside the group", async ({
    freshApp: page,
  }) => {
    await addPlayersBulk(page, ["Locked1", "Locked2", "C", "D", "E"]);
    await lockPair(page, "Locked1", "Locked2");

    // Select Locked1 + 3 unrelated players — Locked2 (the partner) is left out.
    await selectPlayers(page, ["Locked1", "C", "D", "E"]);
    await bulkAction(page, "player-bulk-action-create-quorum");

    await expect(page.getByText("Locked Pairing")).toBeVisible();
    await expect(page.getByText(/lock-paired with Locked2/)).toBeVisible();
    await page.getByTestId("alert-dialog-ok").click();

    await goToStackTab(page);
    await expect(page.getByText("Stack is empty")).toBeVisible();
  });
});

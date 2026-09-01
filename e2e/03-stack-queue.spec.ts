import { test, expect, byIdPrefix, withExactText } from "./fixtures";
import {
  addCourt,
  addPlayer,
  addPlayersBulk,
  addToStackFromPlayerTab,
  bulkAction,
  courtCard,
  courtEndGameButton,
  goToPlayerTab,
  goToStackTab,
  longPressPlayerCard,
  moveToStackDialogCard,
  moveToStackDialogPlayerRow,
  openStackMenu,
  playerCard,
  resetApp,
  selectCard,
  setMultiGroupStacking,
  stackCardPlayerRow,
  stackCards,
  stackCardWithPlayers,
  stackMoveToCourtButton,
} from "./fixtures";

test.describe("Stack screen — queue management", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    // Multi-group stacking is on by default and splits the queue into
    // Beginner/Advanced columns — most of these tests care about plain
    // queue mechanics, so a single flat queue keeps assertions simple.
    await setMultiGroupStacking(page, false);
    await goToStackTab(page);
  });

  test("shows the empty state until a stack exists", async ({ page }) => {
    await goToStackTab(page);
    await expect(page.getByText("Stack is empty")).toBeVisible();
  });

  test("players queue into one stack until it's full, then Ready appears", async ({ page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana"]);
    for (const name of ["Alice", "Bob", "Charlie", "Dana"]) {
      await addToStackFromPlayerTab(page, name);
    }

    await goToStackTab(page);
    await expect(stackCards(page)).toHaveCount(1);
    const card = stackCardWithPlayers(page, ["Alice", "Bob", "Charlie", "Dana"]);
    await expect(card).toBeVisible();
    await expect(card.getByText("Ready")).toBeVisible();

    await goToPlayerTab(page);
    for (const name of ["Alice", "Bob", "Charlie", "Dana"]) {
      await expect(playerCard(page, name).getByText("Stacked")).toBeVisible();
    }
  });

  test("a 5th player spills into a second stack once the first is full", async ({ page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana", "Eve"]);
    for (const name of ["Alice", "Bob", "Charlie", "Dana", "Eve"]) {
      await addToStackFromPlayerTab(page, name);
    }

    await goToStackTab(page);
    await expect(stackCards(page)).toHaveCount(2);
    await expect(stackCardWithPlayers(page, ["Eve"])).toBeVisible();
  });

  test("bulk 'Add to Stack' from multi-select queues everyone in one action", async ({ page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana"]);
    await goToPlayerTab(page);

    await longPressPlayerCard(page, "Alice");
    await expect(page.getByTestId("player-selection-manage")).toBeVisible();
    await expect(page.getByText("1 selected")).toBeVisible();

    await selectCard(page, "Bob", 2);
    await selectCard(page, "Charlie", 3);
    await selectCard(page, "Dana", 4);

    await bulkAction(page, "player-bulk-action-add-to-stack");

    await goToStackTab(page);
    await expect(stackCards(page)).toHaveCount(1);
    await expect(
      stackCardWithPlayers(page, ["Alice", "Bob", "Charlie", "Dana"]).getByText("Ready"),
    ).toBeVisible();
  });

  test("Move to Stack moves a lone player directly into another stack with room", async ({
    page,
  }) => {
    await addPlayersBulk(page, ["Alice", "Bob"]);
    await addToStackFromPlayerTab(page, "Alice");
    await addToStackFromPlayerTab(page, "Bob"); // joins Alice's stack — only one open stack exists

    await goToStackTab(page);
    const stackA = stackCardWithPlayers(page, ["Alice", "Bob"]);
    await expect(stackA).toBeVisible();

    // Split Bob into a brand-new stack via the "New Stack" escape hatch, so
    // we end up with two stacks that both still have room.
    await stackCardPlayerRow(page, stackA, "Bob").click();
    await page.getByTestId("stack-player-action-move-to-stack").click();
    await page.getByTestId("move-to-stack-new").click();

    await expect(stackCards(page)).toHaveCount(2);
    const stackB = stackCardWithPlayers(page, ["Bob"]);
    await expect(stackB).toBeVisible();

    // Now move Bob back into Alice's stack directly (it has room, so no swap picker).
    await stackCardPlayerRow(page, stackB, "Bob").click();
    await page.getByTestId("stack-player-action-move-to-stack").click();
    await expect(page.getByTestId("move-to-stack-dialog")).toBeVisible();
    await withExactText(page.locator(byIdPrefix("move-to-stack-item-")), page, "Alice").click();

    await expect(stackCards(page)).toHaveCount(1);
    await expect(stackCardWithPlayers(page, ["Alice", "Bob"])).toBeVisible();
  });

  test("Move to Stack into a full stack requires picking a player to swap, with confirmation", async ({
    page,
  }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana", "Eve"]);
    for (const name of ["Alice", "Bob", "Charlie", "Dana", "Eve"]) {
      await addToStackFromPlayerTab(page, name);
    }

    await goToStackTab(page);
    const fullStack = stackCardWithPlayers(page, ["Alice", "Bob", "Charlie", "Dana"]);
    const soloStack = stackCardWithPlayers(page, ["Eve"]);
    await expect(fullStack).toBeVisible();
    await expect(soloStack).toBeVisible();

    await stackCardPlayerRow(page, soloStack, "Eve").click();
    await page.getByTestId("stack-player-action-move-to-stack").click();
    await expect(page.getByTestId("move-to-stack-dialog")).toBeVisible();

    // The full stack's card itself isn't tappable — tap the specific player
    // to swap with instead.
    const targetCard = moveToStackDialogCard(page, ["Alice", "Bob", "Charlie", "Dana"]);
    await moveToStackDialogPlayerRow(page, targetCard, "Alice").click();

    await expect(page.getByTestId("confirm-dialog-confirm")).toBeVisible();
    await expect(page.getByText("Swap Eve with Alice?")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    // Eve <-> Alice: the 4-stack keeps Bob/Charlie/Dana/Eve, Alice ends up alone.
    await expect(stackCardWithPlayers(page, ["Bob", "Charlie", "Dana", "Eve"])).toBeVisible();
    await expect(stackCardWithPlayers(page, ["Alice"])).toBeVisible();
  });

  test("Cancelling the swap confirmation leaves both stacks unchanged", async ({ page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana", "Eve"]);
    for (const name of ["Alice", "Bob", "Charlie", "Dana", "Eve"]) {
      await addToStackFromPlayerTab(page, name);
    }

    await goToStackTab(page);
    const soloStack = stackCardWithPlayers(page, ["Eve"]);
    await stackCardPlayerRow(page, soloStack, "Eve").click();
    await page.getByTestId("stack-player-action-move-to-stack").click();
    const targetCard = moveToStackDialogCard(page, ["Alice", "Bob", "Charlie", "Dana"]);
    await moveToStackDialogPlayerRow(page, targetCard, "Alice").click();

    await expect(page.getByTestId("confirm-dialog-confirm")).toBeVisible();
    await page.getByTestId("confirm-dialog-cancel").click();

    await expect(stackCardWithPlayers(page, ["Alice", "Bob", "Charlie", "Dana"])).toBeVisible();
    await expect(stackCardWithPlayers(page, ["Eve"])).toBeVisible();
  });

  test("Remove from Stack frees the player and deletes an emptied stack", async ({ page }) => {
    await addPlayer(page, "Alice");
    await addToStackFromPlayerTab(page, "Alice");

    await goToStackTab(page);
    const card = stackCardWithPlayers(page, ["Alice"]);
    await stackCardPlayerRow(page, card, "Alice").click();
    await page.getByTestId("stack-player-action-remove-from-stack").click();
    await expect(page.getByTestId("confirm-dialog-confirm")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    await expect(page.getByText("Stack is empty")).toBeVisible();
    await goToPlayerTab(page);
    await expect(playerCard(page, "Alice").getByText("Available")).toBeVisible();
  });

  test("Clear Stack frees every player and removes the stack", async ({ page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana"]);
    for (const name of ["Alice", "Bob", "Charlie", "Dana"]) {
      await addToStackFromPlayerTab(page, name);
    }

    await goToStackTab(page);
    const card = stackCardWithPlayers(page, ["Alice", "Bob", "Charlie", "Dana"]);
    await openStackMenu(page, card);
    await page.getByTestId("stack-action-clear").click();
    await expect(page.getByText("Remove all players from this stack?")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    await expect(page.getByText("Stack is empty")).toBeVisible();
    await goToPlayerTab(page);
    for (const name of ["Alice", "Bob", "Charlie", "Dana"]) {
      await expect(playerCard(page, name).getByText("Available")).toBeVisible();
    }
  });

  test("pinning a stack as Up Next overrides the default queue order", async ({ page }) => {
    await addPlayersBulk(page, ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]);
    for (const name of ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]) {
      await addToStackFromPlayerTab(page, name);
    }

    await goToStackTab(page);
    const stackA = stackCardWithPlayers(page, ["A1", "A2", "A3", "A4"]);
    const stackB = stackCardWithPlayers(page, ["B1", "B2", "B3", "B4"]);
    // Oldest (first-created) stack is suggested "Up Next" by default.
    await expect(stackA.getByText("Up Next")).toBeVisible();
    await expect(stackB.getByText("Up Next")).toHaveCount(0);

    await openStackMenu(page, stackB);
    await page.getByTestId("stack-action-set-up-next").click();
    await expect(stackB.getByText("Up Next")).toBeVisible();
    await expect(stackA.getByText("Up Next")).toHaveCount(0);

    await openStackMenu(page, stackB);
    await page.getByTestId("stack-action-unpin").click();
    await expect(stackA.getByText("Up Next")).toBeVisible();
    await expect(stackB.getByText("Up Next")).toHaveCount(0);
  });

  test("Move to Court auto-assigns when exactly one court is free", async ({ page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana"]);
    for (const name of ["Alice", "Bob", "Charlie", "Dana"]) {
      await addToStackFromPlayerTab(page, name);
    }
    await addCourt(page, "Court 1");

    await goToStackTab(page);
    const card = stackCardWithPlayers(page, ["Alice", "Bob", "Charlie", "Dana"]);
    await expect(stackMoveToCourtButton(card)).toBeEnabled();
    await stackMoveToCourtButton(card).click();

    await expect(page.getByText("Stack is empty")).toBeVisible();
    await expect(courtEndGameButton(page, "Court 1")).toBeEnabled();
    const court = courtCard(page, "Court 1");
    for (const name of ["Alice", "Bob", "Charlie", "Dana"]) {
      await expect(court.getByText(name)).toBeVisible();
    }
  });

  test("Move to Court opens a picker when several courts are free", async ({ page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie", "Dana"]);
    for (const name of ["Alice", "Bob", "Charlie", "Dana"]) {
      await addToStackFromPlayerTab(page, name);
    }
    await addCourt(page, "Court 1");
    await addCourt(page, "Court 2");

    await goToStackTab(page);
    const card = stackCardWithPlayers(page, ["Alice", "Bob", "Charlie", "Dana"]);
    await stackMoveToCourtButton(card).click();
    await expect(page.getByTestId("court-picker-dialog")).toBeVisible();
    await withExactText(page.locator(byIdPrefix("court-picker-item-")), page, "Court 2").click();

    await expect(courtEndGameButton(page, "Court 2")).toBeEnabled();
    await expect(courtEndGameButton(page, "Court 1")).toBeDisabled();
  });

  test("Auto-fill vacant slots repacks a gap left by a removed player", async ({ page }) => {
    await addPlayersBulk(page, ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]);
    for (const name of ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]) {
      await addToStackFromPlayerTab(page, name);
    }

    await goToStackTab(page);
    const stackA = stackCardWithPlayers(page, ["A1", "A2", "A3"]);
    await stackCardPlayerRow(page, stackCardWithPlayers(page, ["A1", "A2", "A3", "A4"]), "A4").click();
    await page.getByTestId("stack-player-action-remove-from-stack").click();
    await page.getByTestId("confirm-dialog-confirm").click();

    await expect(page.getByTestId("stack-autofill")).toBeVisible();
    await page.getByTestId("stack-autofill").click();

    // A4's seat gets backfilled from the back of the queue (B's stack),
    // so the front stack is full again and the total player count (7) is preserved.
    await expect(stackA.getByText("Ready")).toBeVisible();
    await expect(page.getByTestId("stack-autofill")).toHaveCount(0);
  });
});

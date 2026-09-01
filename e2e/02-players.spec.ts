import { test, expect } from "./fixtures";
import {
  addPlayer,
  addPlayersBulk,
  dismissBottomSheet,
  goToPlayerTab,
  openPlayerActions,
  playerCard,
  playerCards,
} from "./fixtures";

test.describe("Players screen — roster management", () => {
  test("shows the empty state until a player is added", async ({ freshApp: page }) => {
    await goToPlayerTab(page);
    await expect(page.getByText("No players yet")).toBeVisible();
  });

  test("adds a single player with a rating and defaults to Available", async ({
    freshApp: page,
  }) => {
    await addPlayer(page, "Alice", "3.0");
    const card = playerCard(page, "Alice");
    await expect(card).toBeVisible();
    await expect(card.getByText("3.0")).toBeVisible();
    await expect(card.getByText("Available")).toBeVisible();
    await expect(card.getByText("No matches")).toBeVisible();
  });

  test("bulk-adds several comma-separated names with a shared rating", async ({
    freshApp: page,
  }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie"], "4.0");

    for (const name of ["Alice", "Bob", "Charlie"]) {
      const card = playerCard(page, name);
      await expect(card).toBeVisible();
      await expect(card.getByText("4.0")).toBeVisible();
    }
  });

  test("edits a player's name and rating", async ({ freshApp: page }) => {
    await addPlayer(page, "Alice", "NR");

    await openPlayerActions(page, "Alice");
    await page.getByTestId("player-action-edit").click();
    await expect(page.getByTestId("player-form-modal")).toBeVisible();
    await expect(page.getByTestId("player-form-name-input")).toHaveValue("Alice");
    await page.getByTestId("player-form-name-input").fill("Alicia");
    await page.getByTestId("player-form-rating-3.5").click();
    await page.getByTestId("player-form-submit").click();

    const card = playerCard(page, "Alicia");
    await expect(card).toBeVisible();
    await expect(card.getByText("3.5")).toBeVisible();
    await expect(playerCard(page, "Alice")).toHaveCount(0);
  });

  test("deletes a player via confirm dialog", async ({ freshApp: page }) => {
    await addPlayer(page, "Alice");

    await openPlayerActions(page, "Alice");
    await page.getByTestId("player-action-delete").click();
    await expect(page.getByText("Are you sure you want to remove this player?")).toBeVisible();
    await page.getByTestId("confirm-dialog-confirm").click();

    await expect(playerCard(page, "Alice")).toHaveCount(0);
    await expect(page.getByText("No players yet")).toBeVisible();
  });

  test("searches players by name", async ({ freshApp: page }) => {
    await addPlayersBulk(page, ["Alice", "Bob", "Charlie"]);
    await goToPlayerTab(page);

    await page.getByTestId("player-search").fill("ali");
    await expect(playerCard(page, "Alice")).toBeVisible();
    await expect(playerCard(page, "Bob")).toHaveCount(0);
    await expect(playerCard(page, "Charlie")).toHaveCount(0);

    await page.getByTestId("player-search").fill("nobody");
    await expect(page.getByText("No matching players")).toBeVisible();
  });

  test("filters players by status", async ({ freshApp: page }) => {
    await addPlayersBulk(page, ["Alice", "Bob"]);

    // Move Bob to Idle via his per-player action sheet's switch row (it
    // toggles in place rather than dismissing, so the sheet is closed
    // separately by clicking the backdrop).
    await openPlayerActions(page, "Bob");
    await page.getByTestId("player-action-idle").click();
    await dismissBottomSheet(page);
    await expect(playerCard(page, "Bob").getByText("Idle")).toBeVisible();

    await page.getByTestId("player-filter-button").click();
    await page.getByTestId("status-filter-Idle").click();

    await expect(playerCard(page, "Bob")).toBeVisible();
    await expect(playerCard(page, "Alice")).toHaveCount(0);

    await page.getByTestId("player-filter-button").click();
    await page.getByTestId("status-filter-All").click();
    await expect(playerCard(page, "Alice")).toBeVisible();
    await expect(playerCard(page, "Bob")).toBeVisible();
  });

  test("sorts players by name and by status", async ({ freshApp: page }) => {
    await addPlayer(page, "Zoe");
    await addPlayer(page, "Amy");

    // Default sort is by name (ascending).
    let names = await playerCards(page).allTextContents();
    expect(names).toHaveLength(2);
    expect(names[0]).toContain("Amy");
    expect(names[1]).toContain("Zoe");

    // Make Zoe Idle so a status sort visibly reorders (Available sorts before Idle).
    await openPlayerActions(page, "Zoe");
    await page.getByTestId("player-action-idle").click();
    await dismissBottomSheet(page);

    await page.getByTestId("player-sort-button").click();
    await page.getByTestId("sort-by-status").click();

    names = await playerCards(page).allTextContents();
    expect(names).toHaveLength(2);
    expect(names[0]).toContain("Amy"); // still Available, sorts first
    expect(names[1]).toContain("Zoe"); // now Idle, sorts after Available
  });

  test("standings dialog shows an empty state with no players", async ({ freshApp: page }) => {
    await goToPlayerTab(page);
    await page.getByTestId("player-standings-button").click();
    await expect(page.getByTestId("player-standings-dialog")).toBeVisible();
    await expect(page.getByText("No match history yet.")).toBeVisible();
    await page.getByTestId("player-standings-close").click();
    await expect(page.getByTestId("player-standings-dialog")).toBeHidden();
  });

  test("standings dialog lists an added player with zero matches", async ({ freshApp: page }) => {
    await addPlayer(page, "Alice", "4.0");
    await page.getByTestId("player-standings-button").click();
    const dialog = page.getByTestId("player-standings-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("1 players")).toBeVisible();
    await expect(dialog.getByText("Alice")).toBeVisible();
    await page.getByTestId("player-standings-close").click();
  });

  test("match history dialog shows an empty state for a player with no games", async ({
    freshApp: page,
  }) => {
    await addPlayer(page, "Alice");
    await openPlayerActions(page, "Alice");
    await page.getByTestId("player-action-history").click();
    await expect(page.getByTestId("player-history-dialog")).toBeVisible();
    await expect(page.getByText("No games played yet.")).toBeVisible();
    await page.getByTestId("player-history-close").click();
    await expect(page.getByTestId("player-history-dialog")).toBeHidden();
  });
});

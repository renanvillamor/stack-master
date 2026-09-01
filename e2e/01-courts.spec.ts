import { test, expect } from "./fixtures";
import { addCourt, courtCard, courtEndGameButton, openCourtMenu } from "./fixtures";

test.describe("Court screen — court management", () => {
  test("shows the empty state until a court is added", async ({ freshApp: page }) => {
    await expect(page.getByText("No courts added yet")).toBeVisible();
    await expect(
      page.getByText("Tap + to add a court and start managing games."),
    ).toBeVisible();
  });

  test("adds a court via the FAB and shows it with two empty teams", async ({
    freshApp: page,
  }) => {
    await addCourt(page, "Court 1");

    const card = courtCard(page, "Court 1");
    await expect(card).toBeVisible();
    await expect(card.getByText("Team 1")).toBeVisible();
    await expect(card.getByText("Team 2")).toBeVisible();
    await expect(card.getByText("Empty")).toHaveCount(4);
    await expect(courtEndGameButton(page, "Court 1")).toBeDisabled();
  });

  test("supports adding several independent courts", async ({ freshApp: page }) => {
    await addCourt(page, "Court 1");
    await addCourt(page, "Court 2");
    await addCourt(page, "Court 3");

    await expect(courtCard(page, "Court 1")).toBeVisible();
    await expect(courtCard(page, "Court 2")).toBeVisible();
    await expect(courtCard(page, "Court 3")).toBeVisible();
  });

  test("edits a court's name", async ({ freshApp: page }) => {
    await addCourt(page, "Court 1");

    await openCourtMenu(page, "Court 1");
    await page.getByTestId("court-action-edit").click();

    await expect(page.getByTestId("court-form-modal")).toBeVisible();
    await expect(page.getByTestId("court-form-name-input")).toHaveValue("Court 1");
    await page.getByTestId("court-form-name-input").fill("Main Court");
    await page.getByTestId("court-form-submit").click();

    await expect(page.getByTestId("court-form-modal")).toBeHidden();
    await expect(courtCard(page, "Main Court")).toBeVisible();
    await expect(page.getByText("Court 1", { exact: true })).toHaveCount(0);
  });

  test("cancels a court name edit without saving", async ({ freshApp: page }) => {
    await addCourt(page, "Court 1");

    await openCourtMenu(page, "Court 1");
    await page.getByTestId("court-action-edit").click();
    await page.getByTestId("court-form-name-input").fill("Should Not Save");
    await page.getByTestId("court-form-cancel").click();

    await expect(page.getByTestId("court-form-modal")).toBeHidden();
    await expect(courtCard(page, "Court 1")).toBeVisible();
  });

  test("deleting a court can be cancelled, then confirmed", async ({ freshApp: page }) => {
    await addCourt(page, "Court 1");

    await openCourtMenu(page, "Court 1");
    await page.getByTestId("court-action-delete").click();
    await expect(page.getByText("Remove Court")).toBeVisible();
    await page.getByTestId("confirm-dialog-cancel").click();
    await expect(courtCard(page, "Court 1")).toBeVisible();

    await openCourtMenu(page, "Court 1");
    await page.getByTestId("court-action-delete").click();
    await page.getByTestId("confirm-dialog-confirm").click();

    await expect(courtCard(page, "Court 1")).toHaveCount(0);
    await expect(page.getByText("No courts added yet")).toBeVisible();
  });

  test("empty court's END GAME button stays disabled and has no ⋮ actions beyond Edit/Delete", async ({
    freshApp: page,
  }) => {
    await addCourt(page, "Court 1");
    await openCourtMenu(page, "Court 1");
    await expect(page.getByTestId("court-action-edit")).toBeVisible();
    await expect(page.getByTestId("court-action-delete")).toBeVisible();
    // No active game yet, so the game-only actions must not be offered.
    await expect(page.getByTestId("court-action-move-to-court")).toHaveCount(0);
    await expect(page.getByTestId("court-action-back-to-stack")).toHaveCount(0);
  });
});

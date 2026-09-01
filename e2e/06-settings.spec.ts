import { test, expect } from "./fixtures";
import {
  addPlayer,
  goToPlayerTab,
  goToSettingsTab,
  playerCard,
  switchInput,
} from "./fixtures";

test.describe("Settings screen", () => {
  test.beforeEach(async ({ freshApp: page }) => {
    await goToSettingsTab(page);
  });

  test("toggles Multiple Group Stack, Auto-Stack Players, and Shuffle Players independently", async ({
    page,
  }) => {
    const multiGroup = switchInput(page, "settings-multigroup-switch");
    const autoStack = switchInput(page, "settings-autostack-switch");
    const shuffle = switchInput(page, "settings-shuffle-switch");

    // Defaults per settingsStore.ts.
    await expect(multiGroup).toBeChecked();
    await expect(autoStack).toBeChecked();
    await expect(shuffle).toBeChecked();

    await page.getByTestId("settings-multigroup-switch").click();
    await expect(multiGroup).not.toBeChecked();
    await expect(autoStack).toBeChecked(); // unaffected

    await page.getByTestId("settings-autostack-switch").click();
    await expect(autoStack).not.toBeChecked();

    await page.getByTestId("settings-shuffle-switch").click();
    await expect(shuffle).not.toBeChecked();

    // Persist across a reload (Zustand `persist` -> localStorage).
    await page.reload();
    await goToSettingsTab(page);
    await expect(switchInput(page, "settings-multigroup-switch")).not.toBeChecked();
    await expect(switchInput(page, "settings-autostack-switch")).not.toBeChecked();
    await expect(switchInput(page, "settings-shuffle-switch")).not.toBeChecked();
  });

  test("selects a landscape column count", async ({ page }) => {
    // Default is 2 (settingsStore.ts).
    await expect(page.getByTestId("settings-columns-2")).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("settings-columns-3").click();
    await expect(page.getByTestId("settings-columns-3")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("settings-columns-2")).toHaveAttribute("aria-checked", "false");

    await page.getByTestId("settings-columns-1").click();
    await expect(page.getByTestId("settings-columns-1")).toHaveAttribute("aria-checked", "true");

    // Persists across a reload (settingsStore is Zustand `persist`).
    await page.reload();
    await goToSettingsTab(page);
    await expect(page.getByTestId("settings-columns-1")).toHaveAttribute("aria-checked", "true");
  });

  test("New Session wipes players, courts, and stacks", async ({ page }) => {
    await addPlayer(page, "Alice");
    await goToSettingsTab(page);

    await page.getByTestId("settings-new-session").click();
    await expect(page.getByTestId("settings-new-session-dialog")).toBeVisible();
    await expect(page.getByText("New Session?")).toBeVisible();

    await page.getByTestId("settings-new-session-cancel").click();
    await expect(page.getByTestId("settings-new-session-dialog")).toBeHidden();

    await goToPlayerTab(page);
    await expect(playerCard(page, "Alice")).toBeVisible();

    await goToSettingsTab(page);
    await page.getByTestId("settings-new-session").click();
    await page.getByTestId("settings-new-session-confirm").click();

    await goToPlayerTab(page);
    await expect(page.getByText("No players yet")).toBeVisible();
  });

  test("Team Management: adds a member, edits them, toggles active, and deletes them", async ({
    page,
  }) => {
    await page.getByTestId("settings-team-management").click();
    await expect(page.getByTestId("team-management-modal")).toBeVisible();

    await page.getByTestId("team-add-member").click();
    await expect(page.getByTestId("team-member-form-modal")).toBeVisible();
    await page.getByTestId("team-member-form-name-input").fill("Sam");
    await page.getByTestId("team-member-form-rating-3.0").click();
    await page.getByTestId("team-member-form-submit").click();
    await expect(page.getByTestId("team-member-form-modal")).toBeHidden();

    await expect(page.getByText("Sam")).toBeVisible();
    await expect(page.getByText("1 member")).toBeVisible();

    // Edit.
    const memberRow = page.locator('[data-testid^="team-member-"]', { hasText: "Sam" }).first();
    await memberRow.click();
    await page.getByTestId("team-member-action-edit").click();
    await page.getByTestId("team-member-form-name-input").fill("Samantha");
    await page.getByTestId("team-member-form-submit").click();
    await expect(page.getByText("Samantha")).toBeVisible();

    // New members default to active — toggle off.
    const updatedRow = page
      .locator('[data-testid^="team-member-"]', { hasText: "Samantha" })
      .first();
    const activeSwitch = updatedRow.locator('[data-testid^="team-member-active-"] input');
    await expect(activeSwitch).toBeChecked();
    await activeSwitch.click();
    await expect(activeSwitch).not.toBeChecked();

    // Delete.
    await updatedRow.click();
    await page.getByTestId("team-member-action-delete").click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByText("Samantha")).toHaveCount(0);

    await page.getByTestId("team-management-close").click();
    await expect(page.getByTestId("team-management-modal")).toBeHidden();
  });

  test("New Session reseeds the roster from active team members only", async ({ page }) => {
    await page.getByTestId("settings-team-management").click();

    for (const [name, active] of [
      ["Active One", true],
      ["Inactive One", false],
    ] as const) {
      await page.getByTestId("team-add-member").click();
      await page.getByTestId("team-member-form-name-input").fill(name);
      await page.getByTestId("team-member-form-rating-NR").click();
      await page.getByTestId("team-member-form-submit").click();
      if (!active) {
        const row = page.locator('[data-testid^="team-member-"]', { hasText: name }).first();
        await row.locator('[data-testid^="team-member-active-"] input').click();
      }
    }
    await page.getByTestId("team-management-close").click();

    await page.getByTestId("settings-new-session").click();
    await expect(page.getByText("1 active team member")).toBeVisible();
    await page.getByTestId("settings-new-session-confirm").click();

    await goToPlayerTab(page);
    await expect(playerCard(page, "Active One")).toBeVisible();
    await expect(playerCard(page, "Inactive One")).toHaveCount(0);
  });
});

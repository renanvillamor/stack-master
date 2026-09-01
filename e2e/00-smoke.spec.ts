import { test, expect } from "./fixtures";

test("app boots and all four tabs are reachable", async ({ freshApp: page }) => {
  await expect(page.getByRole("tab", { name: "Court" })).toBeVisible();
  await expect(page.getByText("No courts added yet")).toBeVisible();

  await page.getByRole("tab", { name: "Stack" }).click();
  await expect(page.getByText("Stack is empty")).toBeVisible();

  await page.getByRole("tab", { name: "Players" }).click();
  await expect(page.getByText("No players yet")).toBeVisible();

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByTestId("settings-multigroup-switch")).toBeVisible();
});

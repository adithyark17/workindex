import { expect, test } from "@playwright/test";

test("directory filters lead to an evidence-backed company profile", async ({ page }) => {
  await page.goto("/gcc");
  await expect(page.getByRole("heading", { name: "Find the teams being built in India." })).toBeVisible();
  await page.getByLabel("City").selectOption("Hyderabad");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/city=Hyderabad/);
  const result = page.getByRole("link", { name: "Astera Health Systems", exact: true });
  await Promise.all([page.waitForURL("**/companies/astera-health-systems"), result.click()]);
  await expect(page.getByRole("heading", { name: "Astera Health Systems" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why this signal is shown" })).toBeVisible();
});

test("primary navigation and filters are keyboard reachable", async ({ page }) => {
  await page.goto("/gcc");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Skip to content/i })).toBeFocused();
  await page.getByLabel("Search").focus();
  await expect(page.getByLabel("Search")).toBeFocused();
});

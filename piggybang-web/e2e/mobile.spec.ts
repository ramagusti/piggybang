import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, locale: "id-ID" });

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "pb_token", value: "test-token", url: baseURL! }]);
  await mockApi(page);
});

test("mobile shell: bottom tab bar, no sidebar, no horizontal scroll", async ({ page }) => {
  await page.goto("/app/dashboard");
  const tabBar = page.getByRole("navigation", { name: "Navigasi utama" }).last();
  await expect(tabBar).toBeVisible();
  await expect(tabBar.getByRole("link", { name: "Dasbor" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("aside")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Lainnya opens the more sheet", async ({ page }) => {
  await page.goto("/app/dashboard");
  await page.getByRole("button", { name: "Lainnya" }).click();
  const sheet = page.getByRole("dialog", { name: "Lainnya" });
  await expect(sheet.getByRole("link", { name: "Anggaran" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "WhatsApp" })).toBeVisible();
});

test("transactions render as cards on mobile", async ({ page }) => {
  await page.goto("/app/transactions");
  await expect(page.getByRole("button", { name: /Food & Beverages mixue/ })).toBeVisible();
  await expect(page.locator("table")).toBeHidden();
});

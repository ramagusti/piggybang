import { expect, test } from "@playwright/test";

// Real backend, no mocks. Run: LIVE_API_URL=http://localhost:8010/api npm run e2e -- live
test.skip(!process.env.LIVE_API_URL, "set LIVE_API_URL to run against a real API");

test("register → onboarding → dashboard against live API", async ({ page }) => {
  const email = `live${Date.now()}@test.dev`;
  await page.goto("/register");
  await page.getByLabel("Nama Lengkap").fill("Rama Live");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata Sandi").fill("secret123");
  await page.getByRole("button", { name: /Lanjut/ }).click();
  await page.getByLabel("Nama Tim").fill("Keluarga Live");
  await page.getByRole("button", { name: /Buat Akun/i }).click();

  await expect(page.getByRole("heading", { name: "Cek email kamu ya!" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Lanjut ke aplikasi" }).click();
  await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
  await page.getByRole("button", { name: /Lanjut/ }).click(); // categories
  await page.getByRole("button", { name: /Lanjut/ }).click(); // budgets
  await page.getByText("Tanggal 25").click();
  await page.getByRole("button", { name: /Selesai/ }).click();
  await page.getByRole("button", { name: /Dashboard/i }).or(page.getByRole("link", { name: /Dashboard/i })).first().click();

  await expect(page.getByRole("heading", { name: "Dasbor" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Belum ada transaksi nih. Yuk mulai!").first()).toBeVisible();

  // Backend state reflects the wizard.
  const token = (await page.context().cookies()).find((c) => c.name === "pb_token")!.value;
  const me = await page.request.get(`${process.env.LIVE_API_URL}/user`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const org = (await me.json()).organizations[0];
  expect(org.settings.onboarded).toBe(true);
  const rules = await page.request.get(`${process.env.LIVE_API_URL}/organizations/${org.id}/rules?type=payday`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  expect((await rules.json())[0].date_condition).toBe("25");
});

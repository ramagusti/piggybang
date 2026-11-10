import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test("unauthenticated app route redirects to login", async ({ page }) => {
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Masuk ke Piggybang" })).toBeVisible();
});

test("login lands on the dashboard", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill("rama@example.com");
  await page.getByLabel("Kata Sandi", { exact: true }).fill("secret123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByText("Transaksi Terbaru")).toBeVisible();
  await expect(page.getByText("mixue")).toBeVisible();
});

test("invalid credentials show the API error", async ({ page }) => {
  await mockApi(page, {
    "POST /auth/login": (route) =>
      route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ message: "Email atau kata sandi salah.", errors: { email: ["Email atau kata sandi salah."] } }) }),
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill("rama@example.com");
  await page.getByLabel("Kata Sandi", { exact: true }).fill("wrong-pass");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByText("Email atau kata sandi salah.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("register is a 2-step wizard", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByText("Langkah 1 dari 2")).toBeVisible();
  await page.getByLabel("Nama Lengkap").fill("Rama");
  await page.getByLabel("Email").fill("rama@example.com");
  await page.getByLabel("Kata Sandi").fill("secret123");
  await page.getByRole("button", { name: /Lanjut/ }).click();
  await expect(page.getByText("Langkah 2 dari 2")).toBeVisible();
  await expect(page.getByLabel("Nama Tim")).toBeVisible();
});

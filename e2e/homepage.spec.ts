import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("West Creek Ranch");
  });

  test("shows hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Welcome to Montana/i })).toBeVisible();
  });

  test("shows Get started NOW link for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Get started NOW/i })).toBeVisible();
  });
});

test.describe("Login page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });
});

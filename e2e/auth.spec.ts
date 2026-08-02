import { test, expect, type Page } from "@playwright/test";
import { pinPreferences } from "./fixtures/backend";

/**
 * Auth flow E2E. The backend is stubbed via network mocking rather than a
 * live docker-compose stack, so these run fast and deterministically in CI
 * without requiring Postgres/Redis/Orthanc/vLLM. The core clinical workflow
 * (study load -> AI findings -> QA -> finalize) lives in core-workflow.spec.ts.
 */

test.beforeEach(async ({ page }) => {
  await pinPreferences(page);
});

async function mockBackend(page: Page, login: { status: number; body?: unknown }) {
  // Generic success for every other endpoint the post-login app pings
  // (queue list, reports, notifications, health, ...) so a real login
  // doesn't crash on unrelated unmocked calls.
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }),
  );
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: login.status,
      contentType: "application/json",
      body: JSON.stringify(login.body ?? {}),
    }),
  );
}

test.describe("login page", () => {
  test("renders username, password, and submit controls", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("shows an error on invalid credentials and does not navigate away", async ({ page }) => {
    await mockBackend(page, { status: 401, body: { detail: "Invalid credentials" } });
    await page.goto("/login");

    await page.getByLabel("Username").fill("wrong-user");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("navigates away from /login on valid credentials", async ({ page }) => {
    await mockBackend(page, {
      status: 200,
      body: { user_id: "1", username: "admin", role: "radiologist" },
    });
    await page.goto("/login");

    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password", { exact: true }).fill("admin");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/(?!login)/);
    await expect(page.getByLabel("Username")).toHaveCount(0);
  });
});

test.describe("route guard", () => {
  test("redirects to /login when the backend reports no valid session", async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      }),
    );

    // The redirect happens via a hard `window.location.href` assignment (see
    // apiClient.ts) once the app's first API call comes back 401, which can
    // race/abort the initial navigation Playwright is still tracking - a
    // locator wait tolerates that hand-off better than `waitForURL`.
    await page.goto("/", { waitUntil: "commit" }).catch(() => undefined);

    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login$/);
  });
});

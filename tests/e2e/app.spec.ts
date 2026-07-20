import { expect, test } from "@playwright/test";

// Skip onboarding for all tests except the dedicated onboarding spec.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("gcm.onboarded", "true");
  });
});

test.describe("shell & map", () => {
  test("map screen renders with demo banner, controls, and nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Demo data — fictional scenario")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
    // Map canvas or the explicit list fallback must be present.
    const mapOrFallback = page
      .locator("canvas")
      .or(page.getByText("Interactive map unavailable"));
    await expect(mapOrFallback.first()).toBeVisible({ timeout: 20_000 });
    // All five destinations reachable.
    for (const label of ["Map", "Feed", "Briefings", "Watchlist", "Settings"]) {
      await expect(
        page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label }).first(),
      ).toBeVisible();
    }
  });

  test("list view opens an incident sheet; back button closes it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "More map options" }).click();
    await page.getByRole("button", { name: "List view" }).click();
    const firstIncident = page
      .getByRole("list", { name: "Incident list" })
      .getByRole("button")
      .first();
    await expect(firstIncident).toBeVisible({ timeout: 15_000 });
    await firstIncident.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Confirmed facts")).toBeVisible();
    await expect(sheet.getByText(/independent/i).first()).toBeVisible();
    // Browser back closes the sheet before leaving the page.
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });

  test("category filters narrow the list and reset restores it", async ({ page }) => {
    await page.goto("/?view=list");
    const list = page.getByRole("list", { name: "Incident list" });
    await expect(list.getByRole("button").first()).toBeVisible({ timeout: 15_000 });
    const allCount = await list.getByRole("button").count();
    await page.getByRole("button", { name: /Filters/ }).click();
    await page
      .getByRole("group", { name: "Incident filters" })
      .getByRole("button", { name: /Humanitarian emergency/ })
      .click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect
      .poll(async () => list.getByRole("button").count())
      .toBeLessThan(allCount);
  });
});

test.describe("search", () => {
  test("full-screen search groups results and navigates to an incident", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).click();
    const input = page.getByPlaceholder(/Countries, conflicts/);
    await input.fill("Kessel");
    await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
    await page.getByText("Strikes reported in Northern Kessel Province").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("feed", () => {
  test("news cards carry labels, source counts, and open incident details", async ({ page }) => {
    await page.goto("/feed");
    const card = page.getByRole("article").first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/independent source/).first()).toBeVisible();
    await expect(page.getByText(/Corroborated|Single-source|Unverified/).first()).toBeVisible();
    // Sort control explains itself.
    await page.getByRole("button", { name: /Sort/ }).click();
    await expect(page.getByText(/Why ranked:/).first()).toBeVisible();
  });

  test("official addresses tab shows live badge and detail page", async ({ page }) => {
    await page.goto("/feed");
    await page.getByRole("tab", { name: /Official Addresses/ }).click();
    await expect(page.getByText("Live").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Secretary-General remarks on the Meridian crisis").first().click();
    await expect(page.getByText("Replay available")).toBeVisible();
    await expect(page.getByText("Transcript (timestamped)")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open official source/ })).toBeVisible();
  });
});

test.describe("briefings", () => {
  test("sunrise brief shows lineage, sections, and corrections", async ({ page }) => {
    await page.goto("/briefings");
    await page.getByText("Sunrise Brief").first().click();
    await expect(page.getByText("60-second summary")).toBeVisible();
    await expect(page.getByText("AI-assisted draft")).toBeVisible();
    await expect(page.getByText("Top developments")).toBeVisible();
    await expect(page.getByText("Conflicting reports & remaining uncertainty")).toBeVisible();
    await expect(page.getByText("Sources:").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Save offline/ })).toBeVisible();
  });
});

test.describe("watchlist & settings", () => {
  test("following a country adds it to the followed list", async ({ page }) => {
    await page.goto("/watchlist");
    await page.getByRole("button", { name: "+ Ardenia", exact: true }).click();
    await expect(page.getByText("Following (1)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unfollow Ardenia" })).toBeVisible();
  });

  test("theme switch applies immediately; source transparency lists blocked adapters", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByText("ACLED", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Blocked").first()).toBeVisible();
  });
});

test.describe("onboarding", () => {
  test("first visit shows three skippable screens", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem("gcm.onboarded"));
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: "Welcome" })).toBeVisible();
    await expect(page.getByText("Attributed public reporting")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Labels, not verdicts")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("dialog", { name: "Welcome" })).toBeHidden();
  });
});

test.describe("safety invariants over HTTP", () => {
  test("embargoed and risk-withheld incidents are unreachable", async ({ request }) => {
    for (const id of ["inc-kessel-east-embargoed", "inc-risk-withheld"]) {
      const res = await request.get(`/api/v1/incidents/${id}`);
      expect(res.status()).toBe(404);
    }
  });

  test("public payloads never contain internal fields or precise coordinates", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/incidents?limit=100");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(5);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("internalNotes");
    expect(raw).not.toContain("confidenceScoreInternal");
    expect(raw).not.toContain("riskWithheld");
    for (const item of body.items) {
      expect(item.location.lat).toBe(Math.round(item.location.lat * 10) / 10);
      expect(item.location.lon).toBe(Math.round(item.location.lon * 10) / 10);
      expect(item.location.uncertaintyKm).toBeGreaterThan(0);
    }
  });

  test("invalid query parameters get a stable error object", async ({ request }) => {
    const res = await request.get("/api/v1/incidents?sinceHours=nope");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_query");
    expect(typeof body.error.message).toBe("string");
  });
});

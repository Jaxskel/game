import { expect, test } from "@playwright/test";
import { textToPdf } from "../../lib/pdf/textToPdf";
import { fixtureBookText } from "../../lib/fixtureBook";

// 1x1 transparent PNG (valid image for the cover-identify flow)
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("full flow: photo → identify → fetch → dashboard → highlighted reader → export", async ({
  page,
}) => {
  await page.goto("/");

  // --- capture: "photograph" a cover (mock Gemini identifies it) ---
  await page.setInputFiles('[data-testid="cover-photo-input"]', {
    name: "cover.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });

  // --- confirm: mock returns Romeo and Juliet ---
  await expect(page.getByTestId("title-input")).toHaveValue("Romeo and Juliet");
  await expect(page.getByTestId("author-input")).toHaveValue(
    "William Shakespeare",
  );
  await page.getByTestId("confirm-book").click();

  // --- source: fixture Gutenberg hit → ingest → book page ---
  await page.getByTestId("source-gutenberg-0").click();
  await page.waitForURL(/\/book\/[a-f0-9-]+$/, { timeout: 60_000 });

  // --- dashboard: mock analysis renders ---
  await expect(page.getByTestId("analysis-dashboard")).toBeVisible();
  await expect(page.getByText("Romeo Montague")).toBeVisible();
  await expect(page.getByText("Love vs. hate")).toBeVisible();

  // --- reader: canvas renders, highlights land on the page ---
  await page.getByTestId("open-reader").click();
  await page.waitForURL(/\/reader$/);
  const canvas = page.getByTestId("pdf-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("color-legend")).toBeVisible();

  const firstHighlight = page.getByTestId("highlight-rect").first();
  await expect(firstHighlight).toBeVisible({ timeout: 60_000 });

  // Highlight must sit INSIDE the rendered page canvas.
  const canvasBox = (await canvas.boundingBox())!;
  const hlBox = (await firstHighlight.boundingBox())!;
  expect(hlBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
  expect(hlBox.x + hlBox.width).toBeLessThanOrEqual(
    canvasBox.x + canvasBox.width + 1,
  );
  expect(hlBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
  expect(hlBox.height).toBeGreaterThan(4);
  expect(hlBox.height).toBeLessThan(40); // a text line, not a blob

  // Margin note visible too
  await expect(page.getByTestId("margin-note").first()).toBeVisible();

  // --- page nav works ---
  await page.getByTestId("next-page").click();
  await expect(canvas).toBeVisible();

  // --- annotate every page: completes with the green notice ---
  await page.getByTestId("annotate-all").click();
  await expect(page.getByTestId("annotate-notice")).toContainText(
    "Every page annotated",
    { timeout: 120_000 },
  );

  // --- export: downloads a real PDF ---
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("export-pdf").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/annotated\.pdf$/);
  const path = await download.path();
  const fs = await import("fs");
  const stat = fs.statSync(path!);
  expect(stat.size).toBeGreaterThan(8_000);
  // PDF magic bytes
  const head = fs.readFileSync(path!).subarray(0, 5).toString();
  expect(head).toBe("%PDF-");
});

test("snap-pages path: photos of a paper book become an annotated book", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("skip-photo").click();
  await page.getByTestId("title-input").fill("Long Way Down");
  await page.getByTestId("author-input").fill("Jason Reynolds");
  await page.getByTestId("confirm-book").click();

  // Two "page photos" (mock OCR returns fixture text per image)
  await page.setInputFiles('[data-testid="page-photos-input"]', [
    { name: "p1.png", mimeType: "image/png", buffer: TINY_PNG },
    { name: "p2.png", mimeType: "image/png", buffer: TINY_PNG },
  ]);
  await expect(page.getByTestId("photo-count")).toHaveText("2 pages ready");
  await page.getByTestId("build-from-photos").click();

  await page.waitForURL(/\/book\/[a-f0-9-]+$/, { timeout: 60_000 });
  await expect(page.getByTestId("analysis-dashboard")).toBeVisible();

  await page.getByTestId("open-reader").click();
  await expect(page.getByTestId("pdf-canvas")).toBeVisible();
  await expect(page.getByTestId("highlight-rect").first()).toBeVisible({
    timeout: 60_000,
  });
});

test("snap-video path: a page-flip video becomes an annotated book", async ({
  page,
}) => {
  const { makeFlipVideo } = await import("../fixtures/makeFlipVideo");
  await page.goto("/");
  const videoBytes = await makeFlipVideo(page); // generated in-browser

  await page.getByTestId("skip-photo").click();
  await page.getByTestId("title-input").fill("My Paper Book");
  await page.getByTestId("confirm-book").click();

  await page.setInputFiles('[data-testid="page-video-input"]', {
    name: "flip.webm",
    mimeType: "video/webm",
    buffer: videoBytes,
  });

  await page.waitForURL(/\/book\/[a-f0-9-]+$/, { timeout: 90_000 });
  await expect(page.getByTestId("analysis-dashboard")).toBeVisible();

  await page.getByTestId("open-reader").click();
  await expect(page.getByTestId("pdf-canvas")).toBeVisible();
  await expect(page.getByTestId("highlight-rect").first()).toBeVisible({
    timeout: 60_000,
  });
});

test("upload path: EPUB ebook gets converted and highlighted", async ({ page }) => {
  const { makeEpub } = await import("../fixtures/makeEpub");
  const epubBytes = makeEpub();

  await page.goto("/");
  await page.getByTestId("skip-photo").click();
  await page.getByTestId("title-input").fill("The Lantern Keeper");
  await page.getByTestId("author-input").fill("A. Storyteller");
  await page.getByTestId("confirm-book").click();

  await page.setInputFiles('[data-testid="pdf-upload-input"]', {
    name: "my-ebook.epub",
    mimeType: "application/epub+zip",
    buffer: Buffer.from(epubBytes),
  });

  await page.waitForURL(/\/book\/[a-f0-9-]+$/, { timeout: 60_000 });
  await expect(page.getByTestId("analysis-dashboard")).toBeVisible();

  await page.getByTestId("open-reader").click();
  await expect(page.getByTestId("pdf-canvas")).toBeVisible();
  await expect(page.getByTestId("highlight-rect").first()).toBeVisible({
    timeout: 60_000,
  });
});

test("upload path: user's own PDF gets highlighted", async ({ page }) => {
  const pdfBytes = await textToPdf(
    fixtureBookText(),
    "My Own Edition",
    "A. Storyteller",
  );

  await page.goto("/");
  await page.getByTestId("skip-photo").click();
  await page.getByTestId("title-input").fill("My Own Edition");
  await page.getByTestId("author-input").fill("A. Storyteller");
  await page.getByTestId("confirm-book").click();

  await page.setInputFiles('[data-testid="pdf-upload-input"]', {
    name: "my-edition.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdfBytes),
  });

  await page.waitForURL(/\/book\/[a-f0-9-]+$/, { timeout: 60_000 });
  await expect(page.getByTestId("analysis-dashboard")).toBeVisible();

  await page.getByTestId("open-reader").click();
  await expect(page.getByTestId("pdf-canvas")).toBeVisible();
  await expect(page.getByTestId("highlight-rect").first()).toBeVisible({
    timeout: 60_000,
  });
});

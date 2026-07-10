import type { Page } from "@playwright/test";

/**
 * Generate a small page-flip WebM in the browser (canvas + MediaRecorder):
 * four distinct "pages" each held ~1.4s. Returns the bytes as base64.
 */
export async function makeFlipVideo(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 800;
    const x = c.getContext("2d")!;
    const stream = c.captureStream(15);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((res) => (rec.onstop = () => res()));
    rec.start();
    const pages: [string, string][] = [
      ["Chapter 1", "It was the best of times, it was the worst of times."],
      ["Chapter 2", "Call me Ishmael. Some years ago I went to sea."],
      ["Chapter 3", "In a hole in the ground there lived a hobbit."],
      ["Chapter 4", "It is a truth universally acknowledged."],
    ];
    const draw = (title: string, body: string) => {
      x.fillStyle = "white";
      x.fillRect(0, 0, 600, 800);
      x.fillStyle = "black";
      x.font = "34px Georgia";
      x.fillText(title, 50, 90);
      x.font = "24px Georgia";
      for (let i = 0; i < 6; i++) x.fillText(body, 50, 180 + i * 50);
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const [t, bd] of pages) {
      draw(t, bd);
      await sleep(1400);
    }
    draw(pages[3][0], pages[3][1]);
    await sleep(600);
    rec.stop();
    await done;
    const buf = await new Blob(chunks, { type: "video/webm" }).arrayBuffer();
    let s = "";
    const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  });
  return Buffer.from(b64, "base64");
}

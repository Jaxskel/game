"use client";

import { edgeEnergy, selectPageFrames } from "./frameSelect";

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    const dur = video.duration;
    const target = isFinite(dur) && dur > 0 ? Math.min(time, dur - 0.01) : time;
    video.currentTime = Math.max(0, target);
  });
}

/**
 * Turn a page-flip video into one JPEG per distinct page. Two passes: first a
 * cheap grayscale scan to find which timestamps show settled, distinct pages,
 * then full-resolution capture at just those timestamps.
 */
export async function extractPageFrames(
  file: File,
  onStatus?: (msg: string) => void,
): Promise<File[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Couldn't open this video."));
    });

    // Some phone recordings report Infinity duration until you seek far ahead.
    let duration = video.duration;
    if (!isFinite(duration) || duration === 0) {
      await seek(video, 1e6).catch(() => {});
      duration = video.duration;
    }
    if (!isFinite(duration) || duration === 0) {
      throw new Error("Couldn't read the video length — try re-recording.");
    }

    // Pass 1: sample small grayscale signatures + sharpness across the
    // timeline. Denser sampling (~5/sec) so a steadily-paced flip still lands
    // a sharp frame on each page — no need to freeze on every page.
    const MAX_SAMPLES = 400;
    const step = Math.max(0.2, duration / MAX_SAMPLES);
    const W = 48;
    const H = 64;
    const small = document.createElement("canvas");
    small.width = W;
    small.height = H;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;

    const times: number[] = [];
    const frames: { sig: number[]; sharp: number }[] = [];
    for (let t = 0; t < duration; t += step) {
      await seek(video, t);
      sctx.drawImage(video, 0, 0, W, H);
      const { data } = sctx.getImageData(0, 0, W, H);
      const sig: number[] = [];
      for (let p = 0; p < data.length; p += 4) {
        sig.push((data[p] + data[p + 1] + data[p + 2]) / 3);
      }
      times.push(t);
      frames.push({ sig, sharp: edgeEnergy(sig, W, H) });
      if (times.length % 25 === 0) {
        onStatus?.(`Scanning your video… ${Math.round((t / duration) * 100)}%`);
      }
    }

    const keepIdx = selectPageFrames(frames, { maxFrames: 120 });
    if (keepIdx.length === 0) {
      throw new Error(
        "Couldn't find any clear pages in the video — flip at a steady pace with the book well-lit and in focus.",
      );
    }

    // Pass 2: full-resolution capture at the chosen timestamps.
    const maxDim = 1600;
    const full = document.createElement("canvas");
    const fctx = full.getContext("2d")!;
    const pageFiles: File[] = [];
    for (let k = 0; k < keepIdx.length; k++) {
      onStatus?.(`Capturing page ${k + 1} of ${keepIdx.length}…`);
      await seek(video, times[keepIdx[k]]);
      const scale = Math.min(
        1,
        maxDim / Math.max(video.videoWidth, video.videoHeight),
      );
      full.width = Math.round(video.videoWidth * scale);
      full.height = Math.round(video.videoHeight * scale);
      fctx.drawImage(video, 0, 0, full.width, full.height);
      const blob = await new Promise<Blob | null>((res) =>
        full.toBlob(res, "image/jpeg", 0.82),
      );
      if (blob) {
        pageFiles.push(new File([blob], `page-${k + 1}.jpg`, { type: "image/jpeg" }));
      }
    }
    return pageFiles;
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

// Generates the PWA icon PNGs (192/512, plus maskable variants) without any
// image dependency: raw RGBA pixels -> zlib deflate -> hand-built PNG chunks.
// Design: dark navy field, light globe disc with meridian rings.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size, { maskablePadding = 0 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [11, 15, 20, 255]; // --bg dark
  const globe = [90, 169, 255, 255]; // --accent
  const ring = [11, 15, 20, 255];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * (0.34 - maskablePadding);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let px = bg;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) {
        px = globe;
        // Meridians and equator carved out of the disc.
        const lineW = Math.max(1.5, size * 0.012);
        if (Math.abs(dy) < lineW) px = ring;
        const half = Math.sqrt(Math.max(r * r - dy * dy, 0));
        for (const f of [0, 0.55]) {
          if (Math.abs(Math.abs(dx) - half * f) < lineW && f > 0) px = ring;
          if (f === 0 && Math.abs(dx) < lineW) px = ring;
        }
        // Rim
        if (d > r - Math.max(2, size * 0.015)) px = ring;
      }
      rgba[i] = px[0];
      rgba[i + 1] = px[1];
      rgba[i + 2] = px[2];
      rgba[i + 3] = px[3];
    }
  }
  return png(size, size, rgba);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", drawIcon(192));
writeFileSync("public/icons/icon-512.png", drawIcon(512));
writeFileSync("public/icons/maskable-512.png", drawIcon(512, { maskablePadding: 0.06 }));
console.log("icons written");

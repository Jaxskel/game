// One-time data prep: strip Natural Earth 110m admin-0 countries (public
// domain) down to geometry + name, rounding coordinates to 2 decimals, so the
// basemap ships fully offline with no external tile/glyph dependency.
//
// Usage: node scripts/prepare-countries.mjs <input.geojson> <output.json>
import { readFileSync, writeFileSync } from "node:fs";

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("usage: node scripts/prepare-countries.mjs <in> <out>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(input, "utf8"));

const round = (n) => Math.round(n * 100) / 100;
function roundCoords(coords) {
  if (typeof coords[0] === "number") return coords.map(round);
  return coords.map(roundCoords);
}

const features = raw.features.map((f) => ({
  type: "Feature",
  properties: { name: f.properties.NAME ?? f.properties.name ?? "" },
  geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
}));

writeFileSync(
  output,
  JSON.stringify({ type: "FeatureCollection", features }),
);
console.log(`wrote ${output} with ${features.length} features`);

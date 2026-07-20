/** Build a GeoJSON polygon approximating a circle of radiusKm around a point.
 * Used to draw public uncertainty radii — never precision beyond the
 * generalized location. */
export function circlePolygon(
  lat: number,
  lon: number,
  radiusKm: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const earthRadiusKm = 6371;
  const latRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusKm / earthRadiusKm) * Math.cos(angle);
    const dLon =
      ((radiusKm / earthRadiusKm) * Math.sin(angle)) / Math.max(Math.cos(latRad), 0.05);
    coords.push([lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

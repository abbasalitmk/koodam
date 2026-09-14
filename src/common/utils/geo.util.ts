const EARTH_RADIUS_M = 6_378_137;

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Ghost Privacy Guard.
 *
 * Public spatial reads must never resolve to a home address, so every profile
 * carries a second point offset by a random bearing at a random distance inside
 * [minMeters, maxMeters]. The offset is regenerated whenever the user's real
 * position changes materially, which keeps repeated reads from triangulating
 * the true location by averaging.
 */
export function computeGhostPoint(
  real: LatLng,
  minMeters = 400,
  maxMeters = 900,
): LatLng {
  const distance = minMeters + Math.random() * Math.max(0, maxMeters - minMeters);
  const bearing = Math.random() * 2 * Math.PI;

  const dLat = (distance * Math.cos(bearing)) / EARTH_RADIUS_M;
  const dLng =
    (distance * Math.sin(bearing)) /
    (EARTH_RADIUS_M * Math.cos((real.latitude * Math.PI) / 180));

  return {
    latitude: round6(real.latitude + (dLat * 180) / Math.PI),
    longitude: round6(real.longitude + (dLng * 180) / Math.PI),
  };
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance shown to other users. Precision is deliberately coarse — exposing
 * "2.437 km" from several vantage points is enough to trilaterate a position.
 */
export function fuzzDistanceMeters(meters: number): number {
  if (meters < 1000) return Math.round(meters / 100) * 100;
  if (meters < 10_000) return Math.round(meters / 100) * 100;
  return Math.round(meters / 1000) * 1000;
}

export function formatDistance(meters: number): string {
  const fuzzed = fuzzDistanceMeters(meters);
  if (fuzzed < 1000) return `${Math.max(100, fuzzed)} m away`;
  return `${(fuzzed / 1000).toFixed(1)} km away`;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

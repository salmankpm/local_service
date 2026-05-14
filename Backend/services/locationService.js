const haversine = require('../utils/haversine');

/**
 * Build a MongoDB $nearSphere geo query
 */
const buildGeoQuery = (lat, lng, radiusKm = 5) => ({
  $nearSphere: {
    $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
    $maxDistance: parseFloat(radiusKm) * 1000, // metres
  },
});

/**
 * Filter an array of worker objects by distance from a point.
 * Useful when you have already-fetched workers and want to sort/annotate.
 */
const annotateWithDistance = (workers, userLat, userLng) =>
  workers
    .map((w) => {
      const [lng, lat] = w.user?.location?.coordinates || [0, 0];
      const distanceKm = haversine(userLat, userLng, lat, lng);
      return { ...w.toObject(), distanceKm: Math.round(distanceKm * 10) / 10 };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

/**
 * Parse lat/lng safely from request query
 */
const parseCoords = (query) => {
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
};

module.exports = { buildGeoQuery, annotateWithDistance, parseCoords };
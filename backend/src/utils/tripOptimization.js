const EARTH_RADIUS_METERS = 6371000;

function haversineMeters(a, b) {
  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const deltaLat = latB - latA;
  const deltaLng = toRadians(Number(b.lng) - Number(a.lng));
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, value)));
}

export function buildTripDistanceMatrix(stops = []) {
  return stops.map((from) =>
    stops.map((to) => haversineMeters(from, to))
  );
}

export function buildTripEstimatedDurationMatrix(stops = [], averageSpeedKmh = 30) {
  const metersPerSecond = Math.max(Number(averageSpeedKmh) || 30, 5) / 3.6;
  return buildTripDistanceMatrix(stops).map((row) =>
    row.map((distance) => distance / metersPerSecond)
  );
}

function normalizeMatrix(stops, matrix) {
  const fallback = buildTripEstimatedDurationMatrix(stops);
  return stops.map((_, rowIndex) =>
    stops.map((_, columnIndex) => {
      const value = matrix?.[rowIndex]?.[columnIndex];
      return value !== null && value !== undefined && Number.isFinite(Number(value))
        ? Math.max(0, Number(value))
        : fallback[rowIndex][columnIndex];
    })
  );
}

function routeCost(order, matrix) {
  let total = 0;
  for (let index = 0; index < order.length - 1; index += 1) {
    total += matrix[order[index]][order[index + 1]];
  }
  return total;
}

/**
 * Keep the first stop fixed, then use nearest-neighbour + 2-opt on the
 * OSRM duration matrix. The same function accepts a distance matrix as a
 * deterministic fallback when the routing provider's table service is absent.
 */
export function optimizeTripOrder(stops = [], matrix = []) {
  if (stops.length <= 2) return stops.map((_, index) => index);

  const costs = normalizeMatrix(stops, matrix);
  const remaining = new Set(
    Array.from({ length: stops.length - 1 }, (_, index) => index + 1)
  );
  const order = [0];

  while (remaining.size) {
    const current = order[order.length - 1];
    let next = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const candidate of remaining) {
      const cost = costs[current][candidate];
      if (cost < bestCost) {
        bestCost = cost;
        next = candidate;
      }
    }

    if (next === null) next = remaining.values().next().value;
    order.push(next);
    remaining.delete(next);
  }

  let improved = true;
  let passes = 0;
  while (improved && passes < stops.length) {
    improved = false;
    passes += 1;
    let bestOrder = order;
    let bestCost = routeCost(order, costs);

    for (let start = 1; start < order.length - 1; start += 1) {
      for (let end = start + 1; end < order.length; end += 1) {
        const candidate = [
          ...order.slice(0, start),
          ...order.slice(start, end + 1).reverse(),
          ...order.slice(end + 1)
        ];
        const candidateCost = routeCost(candidate, costs);
        if (candidateCost + 0.001 < bestCost) {
          bestCost = candidateCost;
          bestOrder = candidate;
        }
      }
    }

    if (bestOrder !== order) {
      order.splice(0, order.length, ...bestOrder);
      improved = true;
    }
  }

  return order;
}

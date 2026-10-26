import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { listManagedPlaces } from './partnerPortal.service.js';

const METRIC_KEYS = ['views', 'calls', 'directions', 'websites'];

function emptyMetrics() {
  return { views: 0, calls: 0, directions: 0, websites: 0 };
}

function addMetrics(target, source) {
  for (const key of METRIC_KEYS) {
    target[key] += Number(source[key] || 0);
  }
}

function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

function dateSeries(today, days) {
  const start = new Date(today + 'T00:00:00.000Z');
  start.setUTCDate(start.getUTCDate() - days + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), ...emptyMetrics() };
  });
}

export async function recordPlaceEngagement(placeId, eventType) {
  // Only count public places. Never persist IP, user ID, cookies or user-agent.
  if (!/^[1-9]\d{0,14}$/.test(String(placeId))) {
    throw new AppError('Invalid place ID.', 400);
  }

  const { rows } = await pool.query(
    [
      'INSERT INTO place_engagement_daily (place_id, day, event_type, event_count)',
      "SELECT p.id, (NOW() AT TIME ZONE 'Asia/Bangkok')::date, $2::text, 1",
      'FROM places p',
      "WHERE p.id = $1::bigint AND p.status = 'PUBLISHED'",
      'ON CONFLICT (place_id, day, event_type)',
      'DO UPDATE SET event_count = place_engagement_daily.event_count + 1',
      'RETURNING place_id'
    ].join('\n'),
    [placeId, eventType]
  );

  if (!rows.length) throw new AppError('Place not found.', 404);
}

export async function getPartnerAnalytics({ userId, days = 30, placeId = null }) {
  const managedPlaces = [...new Map(
    (await listManagedPlaces(userId)).map((item) => [String(item.placeId), item])
  ).values()];

  const selectedPlaces = placeId
    ? managedPlaces.filter((item) => String(item.placeId) === String(placeId))
    : managedPlaces;

  if (placeId && !selectedPlaces.length) {
    throw new AppError('You do not manage this place.', 403);
  }

  const today = bangkokToday();
  const daily = dateSeries(today, days);
  const totals = emptyMetrics();
  const places = selectedPlaces.map((item) => ({
    placeId: String(item.placeId),
    name: item.name,
    ...emptyMetrics()
  }));

  if (!places.length) {
    return {
      days,
      fromDate: daily[0].date,
      toDate: today,
      totals,
      daily,
      places
    };
  }

  const { rows } = await pool.query(
    [
      'SELECT place_id::text AS place_id,',
      "  to_char(day, 'YYYY-MM-DD') AS date,",
      "  COALESCE(SUM(event_count) FILTER (WHERE event_type = 'VIEW'), 0) AS views,",
      "  COALESCE(SUM(event_count) FILTER (WHERE event_type = 'CALL'), 0) AS calls,",
      "  COALESCE(SUM(event_count) FILTER (WHERE event_type = 'DIRECTIONS'), 0) AS directions,",
      "  COALESCE(SUM(event_count) FILTER (WHERE event_type = 'WEBSITE'), 0) AS websites",
      'FROM place_engagement_daily',
      'WHERE place_id = ANY($1::bigint[])',
      '  AND day BETWEEN ($2::date - ($3::integer - 1)) AND $2::date',
      'GROUP BY place_id, day',
      'ORDER BY day ASC, place_id ASC'
    ].join('\n'),
    [places.map((item) => item.placeId), today, days]
  );

  const byDay = new Map(daily.map((item) => [item.date, item]));
  const byPlace = new Map(places.map((item) => [item.placeId, item]));

  for (const row of rows) {
    const day = byDay.get(row.date);
    const place = byPlace.get(row.place_id);
    if (!day || !place) continue;

    addMetrics(day, row);
    addMetrics(place, row);
    addMetrics(totals, row);
  }

  places.sort((a, b) =>
    (b.views - a.views) || (b.calls - a.calls) ||
    (b.directions - a.directions) || a.name.localeCompare(b.name, 'vi')
  );

  return {
    days,
    fromDate: daily[0].date,
    toDate: today,
    totals,
    daily,
    places
  };
}

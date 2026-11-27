// WA-005: site-owned aggregate store. No raw event trail or visitor identity.
import { createHash } from 'node:crypto';
import { pool } from '../database/pool.js';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const allowedDays = new Set([7, 30, 90]);
const calendar = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});

export class Wa005SourceUnavailable extends Error {
  constructor() {
    super('Consented analytics source is not ready.');
    this.code = 'WA005_SOURCE_UNAVAILABLE';
  }
}

export function vietnamDay(value) {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('Invalid event time');
  const parts = Object.fromEntries(calendar.formatToParts(instant)
    .filter(({ type }) => ['year', 'month', 'day'].includes(type))
    .map(({ type, value: part }) => [type, part]));
  return [parts.year, parts.month, parts.day].join('-');
}

export function dateWindow(days, now = new Date()) {
  if (!allowedDays.has(days)) throw new RangeError('Invalid reporting period');
  const end = vietnamDay(now);
  const firstDay = new Date(end + 'T00:00:00.000Z');
  firstDay.setUTCDate(firstDay.getUTCDate() - (days - 1));
  return { start: firstDay.toISOString().slice(0, 10), end };
}

// A page is counted once from page_view, including an individual detail page.
// map_place_view counts only when the place was opened on the MAP itself;
// on /place or /dia-diem it accompanies page_view and must not double-count.
// Navigation to directions counts as contact intent; search/favorite do not.
// lead_submitted is deliberately NOT trusted without a verified server-side
// successful lead form. This repository has no such CRM submit event.
export function wa005MetricFor(event) {
  if (!event || event.consent !== true) return null;
  if (event.name === 'page_view') return 'pageViews';
  if (event.name === 'map_place_view' &&
    (event.path === '/map' || event.path === '/local-map')) return 'pageViews';
  if (event.name === 'contact_click' ||
      event.name === 'map_directions_click') return 'contactClicks';
  return null;
}

function safeCounter(value) {
  if (!/^(0|[1-9][0-9]*)$/.test(String(value))) {
    throw new Wa005SourceUnavailable();
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Wa005SourceUnavailable();
  }
  return count;
}

export function createWa005ConsentedStore({ db = pool, now = () => new Date() } = {}) {
  async function ingest(batch) {
    // The POST router must validate the WA-002 schema, explicit consent,
    // exact site Origin and GPC/DNT before invoking this method.
    if (!batch || !Array.isArray(batch.events) || batch.events.length === 0 ||
        batch.events.length > 20 || batch.events.some((e) => e?.consent !== true)) {
      throw new TypeError('Unconsented or malformed batch');
    }

    const client = await db.connect();
    const grouped = new Map();
    let accepted = 0;
    try {
      await client.query('BEGIN');
      for (const event of batch.events) {
        const metric = wa005MetricFor(event);
        if (!metric) continue;
        if (typeof event.eventId !== 'string' ||
            typeof event.occurredAt !== 'string') {
          throw new TypeError('Malformed consented event');
        }

        // Event IDs are freshly random per event. Retain only a one-way SHA-256
        // digest for bounded deduplication; never retain sessionId or the event.
        const digest = createHash('sha256').update(event.eventId).digest();
        const inserted = await client.query(
          `INSERT INTO wa005_consented_event_dedup(event_digest)
           VALUES ($1) ON CONFLICT (event_digest) DO NOTHING
           RETURNING event_digest`,
          [digest]
        );
        if (inserted.rowCount !== 1) continue;
        accepted += 1;
        const day = vietnamDay(event.occurredAt);
        const counts = grouped.get(day) || {
          pageViews: 0, contactClicks: 0, leadSubmissions: 0
        };
        counts[metric] += 1;
        grouped.set(day, counts);
      }

      for (const [day, counts] of grouped) {
        await client.query(
          `INSERT INTO wa005_consented_daily_counts
             (day, page_views, contact_clicks, lead_submissions)
           VALUES ($1::date, $2::bigint, $3::bigint, $4::bigint)
           ON CONFLICT (day) DO UPDATE SET
             page_views = wa005_consented_daily_counts.page_views + EXCLUDED.page_views,
             contact_clicks = wa005_consented_daily_counts.contact_clicks + EXCLUDED.contact_clicks,
             lead_submissions = wa005_consented_daily_counts.lead_submissions + EXCLUDED.lead_submissions`,
          [day, counts.pageViews, counts.contactClicks, counts.leadSubmissions]
        );
      }
      await client.query('COMMIT');
      return { accepted };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* original error takes precedence */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async function readSummary(days) {
    const generatedAt = now();
    const { start, end } = dateWindow(days, generatedAt);

    // No persisted evidence of a consented source => 503, not invented zeros.
    // This is intentionally separate from the 15-minute softLaunchMetrics.
    const readiness = await db.query(
      'SELECT EXISTS (SELECT 1 FROM wa005_consented_daily_counts LIMIT 1) AS ready'
    );
    if (readiness.rows[0]?.ready !== true) throw new Wa005SourceUnavailable();

    const { rows } = await db.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, page_views, contact_clicks,
              lead_submissions
       FROM wa005_consented_daily_counts
       WHERE day BETWEEN $1::date AND $2::date
       ORDER BY day ASC`,
      [start, end]
    );

    const metrics = { pageViews: 0, contactClicks: 0, leadSubmissions: 0 };
    const daily = rows.map((row) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day) ||
          row.day < start || row.day > end) throw new Wa005SourceUnavailable();
      const entry = {
        day: row.day,
        pageViews: safeCounter(row.page_views),
        contactClicks: safeCounter(row.contact_clicks),
        leadSubmissions: safeCounter(row.lead_submissions)
      };
      for (const name of ['pageViews', 'contactClicks', 'leadSubmissions']) {
        const sum = metrics[name] + entry[name];
        if (!Number.isSafeInteger(sum)) throw new Wa005SourceUnavailable();
        metrics[name] = sum;
      }
      return entry;
    });

    return {
      schemaVersion: 1,
      siteCode: 'bandohoalac',
      siteHost: 'maps.dothihoalac.vn',
      period: { days, timezone: TIMEZONE },
      generatedAt: generatedAt.toISOString(),
      privacy: { consent: 'explicit_opt_in', granularity: 'aggregate_only' },
      metrics,
      daily
    };
  }

  async function prune() {
    const removedDigests = await db.query(
      `DELETE FROM wa005_consented_event_dedup
       WHERE received_at < NOW() - INTERVAL '48 hours'`
    );
    const removedDays = await db.query(
      `DELETE FROM wa005_consented_daily_counts
       WHERE day < ((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 100)`
    );
    return { digests: removedDigests.rowCount, days: removedDays.rowCount };
  }

  return { ingest, readSummary, prune };
}

export const wa005ConsentedStore = createWa005ConsentedStore();

import { pool } from '../database/pool.js';

export function createDatabaseReadinessProbe({
  queryFn = (config) => pool.query(config),
  now = () => Date.now(),
  timeoutMs = 1500,
  cacheMs = 2500
} = {}) {
  let cached = null;
  let expiresAt = 0;
  let pending = null;

  return function databaseReadiness() {
    if (cached && now() < expiresAt) return Promise.resolve(cached);
    if (pending) return pending;

    const started = process.hrtime.bigint();
    pending = (async () => {
      let timer;
      try {
        const result = await Promise.race([
          Promise.resolve().then(() => queryFn({
            text: 'SELECT 1 AS ok',
            query_timeout: timeoutMs
          })),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('probe-timeout')), timeoutMs);
          })
        ]);
        const ok = Number(result?.rows?.[0]?.ok) === 1;
        return {
          ok,
          database: ok ? 'up' : 'down',
          latencyMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6)
        };
      } catch {
        // Don't reveal DB hostnames, credentials, SQL errors or private topology.
        return {
          ok: false,
          database: 'down',
          latencyMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6)
        };
      } finally {
        if (timer) clearTimeout(timer);
      }
    })().then((result) => {
      cached = result;
      expiresAt = now() + cacheMs;
      return result;
    }).finally(() => { pending = null; });
    return pending;
  };
}

export const getDatabaseReadiness = createDatabaseReadinessProbe();

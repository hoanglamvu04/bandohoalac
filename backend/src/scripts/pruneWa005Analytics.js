// Schedule only after approval. Deletes transient event digests after 48 h
// and daily aggregates older than 100 Vietnam-local calendar days.
import { pool } from '../database/pool.js';
import { wa005ConsentedStore } from '../services/wa005ConsentedAnalytics.service.js';

try {
  const result = await wa005ConsentedStore.prune();
  console.log('[WA-005] retention cleanup completed', JSON.stringify(result));
} catch {
  // No raw SQL, secrets or client identifiers in operational logs.
  console.error('[WA-005] retention cleanup failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}

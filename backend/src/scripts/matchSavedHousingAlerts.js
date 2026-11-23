// Called by an approved backend cron schedule, never by the browser.
// The service transaction is idempotent; no email/SMS or X-HUB telemetry.
import { pool } from '../database/pool.js';
import { generateSavedHousingAlerts } from '../services/housingIntelligence.service.js';

try {
  const result = await generateSavedHousingAlerts();
  console.log('[housing-saved-alerts]', JSON.stringify(result));
} catch {
  // Avoid logging user-saved search strings or account data.
  console.error('[housing-saved-alerts] matcher failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}

import { pool } from '../database/pool.js';
import { remindExpiringProperties } from '../services/housingReminders.service.js';

remindExpiringProperties()
  .then((count) => console.log('[housing-reminder] notifications sent:', count))
  .catch((error) => { console.error('[housing-reminder]', error); process.exitCode = 1; })
  .finally(() => pool.end());

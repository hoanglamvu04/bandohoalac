import { pool } from '../database/pool.js';
import { pruneSoftLaunchData } from '../services/softLaunchV1.service.js';

pruneSoftLaunchData()
  .then((result) => console.log('[soft-launch-prune]', JSON.stringify(result)))
  .catch((error) => {
    console.error('[soft-launch-prune]', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

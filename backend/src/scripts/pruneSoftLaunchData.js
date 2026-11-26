import { pool } from '../database/pool.js';
import { pruneSoftLaunchData } from '../services/softLaunchV1.service.js';
import { pruneHousingEngagement } from '../services/housingMetrics.service.js';

pruneSoftLaunchData()
  .then(async (result) => {
    const housing=await pruneHousingEngagement();
    console.log('[soft-launch-prune]', JSON.stringify({...result,housing}));
  })
  .catch((error) => {
    console.error('[soft-launch-prune]', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

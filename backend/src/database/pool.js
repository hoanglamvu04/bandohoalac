import pg from 'pg';
import { env } from '../config/env.js';
import { databasePoolOptions } from './poolConfig.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  application_name: 'hola-maps',
  ...databasePoolOptions()
});

pool.on('error', (err) => {
  // A database error can contain query text, row values or connection details.
  console.error('Unexpected PostgreSQL pool error', { code: String(err?.code || 'UNKNOWN').slice(0,32) });
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(callback, db = pool) {
  const client = await db.connect();
  let phase = 'begin';
  let discard;
  try {
    await client.query('BEGIN');
    phase = 'work';
    const result = await callback(client);
    phase = 'commit';
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Failed BEGIN or uncertain COMMIT must not return a possibly broken
    // session to the pool. Never auto-retry a transaction after COMMIT fails.
    if (phase !== 'work') discard = error instanceof Error ? error : new Error('Transaction failed');
    if (phase !== 'begin') {
      try { await client.query('ROLLBACK'); }
      catch (rollbackError) { discard = rollbackError instanceof Error ? rollbackError : new Error('Rollback failed'); }
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

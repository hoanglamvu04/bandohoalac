import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';

const CONFIRMATION = 'RESTORE_IN_EMPTY_HOLA_RESTORE_DB';
const FILE_PATTERN = /^hola-maps-\d{8}T\d{6}Z\.dump$/;

export function assertSafeRestoreTarget(productionUrl, restoreUrl, confirmation) {
  if (confirmation !== CONFIRMATION) {
    throw new Error('An explicit RESTORE_DRILL_CONFIRM is required.');
  }
  let prod;
  let target;
  try {
    prod = new URL(productionUrl);
    target = new URL(restoreUrl);
  } catch {
    throw new Error('Production and restore database URLs must be valid.');
  }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
      !['postgres:', 'postgresql:'].includes(prod.protocol)) {
    throw new Error('Restore requires PostgreSQL URLs.');
  }
  const targetDb = decodeURIComponent(target.pathname.slice(1));
  const sourceDb = decodeURIComponent(prod.pathname.slice(1));
  if (!/^hola_restore_[a-z0-9_]{3,48}$/.test(targetDb)) {
    throw new Error('Target database name must start with hola_restore_ and have a safe suffix.');
  }
  if (targetDb === sourceDb) {
    throw new Error('Refusing to restore into the production database.');
  }
  return { targetDb, target };
}

async function sha256(filename) {
  return new Promise((resolve, reject) => {
    const digest = createHash('sha256');
    const stream = createReadStream(filename);
    stream.on('data', (chunk) => digest.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(digest.digest('hex')));
  });
}

export async function verifyDumpWithChecksum(backupDir) {
  const files = (await readdir(backupDir))
    .filter((name) => FILE_PATTERN.test(name))
    .sort().reverse();
  if (!files.length) throw new Error('No timestamped database dump found in BACKUP_DIR.');
  const selected = files[0];
  const filename = path.join(backupDir, selected);
  if (!(await stat(filename)).isFile()) throw new Error('Backup is not a regular file.');
  const content = (await readFile(filename + '.sha256', 'utf8')).trim();
  const expectedLine = content.match(/^([a-f0-9]{64})  (hola-maps-\d{8}T\d{6}Z\.dump)$/);
  if (!expectedLine || expectedLine[2] !== selected) {
    throw new Error('Invalid or mismatched SHA256 manifest for database backup.');
  }
  const actual = await sha256(filename);
  if (actual !== expectedLine[1]) {
    throw new Error('Database backup failed SHA256 integrity verification.');
  }
  return filename;
}

function runProcess(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, ...extraEnv },
      windowsHide: true
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      // Bound logging; do not print potentially sensitive SQL/data to stdout.
      if (stderr.length < 1400) stderr += String(chunk).slice(0, 1400 - stderr.length);
    });
    child.once('error', () => reject(new Error(command + ' is missing or cannot start.')));
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(command + ' failed (exit ' + code + '): ' + stderr.replace(/postgres(?:ql)?:\/\/\S+/g, '<redacted-url>')));
    });
  });
}

function pgCommandEnvironment(target, targetDb) {
  return {
    PGHOST: target.hostname,
    PGPORT: target.port || '5432',
    PGUSER: decodeURIComponent(target.username || ''),
    PGPASSWORD: decodeURIComponent(target.password || ''),
    PGDATABASE: targetDb,
    PGCONNECT_TIMEOUT: '10',
    ...(target.searchParams.has('sslmode')
      ? { PGSSLMODE: target.searchParams.get('sslmode') }
      : {})
  };
}

export async function runRestoreDrill({
  productionUrl = env.databaseUrl,
  targetUrl = process.env.RESTORE_DRILL_DATABASE_URL,
  confirmation = process.env.RESTORE_DRILL_CONFIRM,
  backupDir = process.env.BACKUP_DIR || path.resolve('backups')
} = {}) {
  const { targetDb, target } = assertSafeRestoreTarget(productionUrl, targetUrl, confirmation);
  const client = new pg.Client({
    connectionString: targetUrl,
    connectionTimeoutMillis: 10000
  });
  await client.connect();

  try {
    const { rows: [inspect] } = await client.query(
      "SELECT current_database() AS database_name, " +
      "(SELECT COUNT(*)::int FROM pg_class t " +
      "JOIN pg_namespace n ON n.oid=t.relnamespace " +
      "WHERE t.relkind IN ('r','p') " +
      "AND n.nspname NOT IN ('pg_catalog','information_schema') " +
      "AND n.nspname NOT LIKE 'pg_toast%' " +
      "AND NOT (n.nspname='public' AND t.relname='spatial_ref_sys')) AS user_tables"
    );
    if (inspect.database_name !== targetDb || inspect.user_tables !== 0) {
      throw new Error('Restore target is not empty. No existing tables will be overwritten.');
    }

    const dump = await verifyDumpWithChecksum(path.resolve(backupDir));
    await runProcess('pg_restore', ['--list', dump]);
    await runProcess('pg_restore', [
      '--single-transaction', '--exit-on-error',
      '--no-owner', '--no-acl', '--no-tablespaces',
      '--dbname=' + targetDb, dump
    ], pgCommandEnvironment(target, targetDb));

    const { rows: [check] } = await client.query(
      "SELECT to_regclass('public.places') IS NOT NULL AS has_places, " +
      "to_regclass('public.users') IS NOT NULL AS has_users, " +
      "to_regclass('public.housing_listings') IS NOT NULL AS has_housing, " +
      "to_regclass('public.place_images') IS NOT NULL AS has_images"
    );
    if (!check.has_places || !check.has_users || !check.has_housing || !check.has_images) {
      throw new Error('Restored database is missing required HOLA Maps tables.');
    }
    const { rows: [counts] } = await client.query(
      "SELECT (SELECT COUNT(*)::int FROM places) AS places, " +
      "(SELECT COUNT(*)::int FROM users) AS users, " +
      "(SELECT COUNT(*)::int FROM place_images) AS images, " +
      "(SELECT COUNT(*)::int FROM housing_listings) AS housing"
    );

    return {
      restored: true,
      backupFile: path.basename(dump),
      targetDatabase: targetDb,
      requiredTables: check,
      counts,
      warning: 'Review the drill and DROP the isolated restore database promptly; it may contain private data.'
    };
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runRestoreDrill()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error('[restore-drill]', error.message);
      process.exitCode = 1;
    });
}

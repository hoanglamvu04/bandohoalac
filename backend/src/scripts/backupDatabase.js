import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { env } from '../config/env.js';

const backupDir = process.env.BACKUP_DIR || path.resolve('backups');
const optional = process.argv.includes('--optional');
const retentionDays = Math.min(Math.max(Number(process.env.BACKUP_RETENTION_DAYS) || 14, 1), 90);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(command + ' failed: ' + stderr.slice(0, 1200)));
    });
  });
}

function sha256File(filename) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filename);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function rotate() {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const names = await readdir(backupDir).catch(() => []);

  for (const name of names) {
    if (!/^hola-maps-.*\.(dump|sha256)$/.test(name)) continue;
    const stamp = name.match(/hola-maps-(\d{8}T\d{6}Z)/)?.[1];
    if (!stamp) continue;
    const date = new Date(
      stamp.slice(0, 4) + '-' + stamp.slice(4, 6) + '-' + stamp.slice(6, 8) +
      'T' + stamp.slice(9, 11) + ':' + stamp.slice(11, 13) + ':' + stamp.slice(13, 15) + 'Z'
    );
    if (Number.isFinite(date.getTime()) && date.getTime() < cutoff) {
      await rm(path.join(backupDir, name), { force: true });
    }
  }
}

async function main() {
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const temp = path.join(backupDir, '.hola-maps-' + stamp + '.tmp');
  const output = path.join(backupDir, 'hola-maps-' + stamp + '.dump');

  try {
    await run('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--file=' + temp,
      env.databaseUrl
    ]);

    await run('pg_restore', ['--list', temp]);
    await rename(temp, output);
    const digest = await sha256File(output);
    await writeFile(output + '.sha256', digest + '  ' + path.basename(output) + '\n', { mode: 0o600 });
    await rotate();
    console.log('[backup] verified database backup:', output);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  if (optional) {
    console.warn('[backup] skipped:', error.message);
    return;
  }
  console.error('[backup]', error.message);
  process.exitCode = 1;
});

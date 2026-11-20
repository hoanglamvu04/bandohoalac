import { createHash, createReadStream } from 'node:crypto';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { env } from '../config/env.js';

const backupDir = path.resolve(process.env.BACKUP_DIR || 'backups');
const retentionDays = Math.min(Math.max(Number(process.env.BACKUP_RETENTION_DAYS) || 14, 1), 90);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(command + ': ' + stderr.slice(0, 500))));
  });
}

function checksum(file) {
  return new Promise((resolve, reject) => {
    const digest = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', chunk => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}

async function main() {
  if (env.uploadProvider !== 'local') {
    throw new Error(
      'UPLOAD_PROVIDER=' + env.uploadProvider +
      ': local media backup is not valid. Configure and test a provider export before public launch.'
    );
  }
  const source = path.resolve(env.uploadDir);
  const meta = await stat(source).catch(() => null);
  if (!meta?.isDirectory()) throw new Error('Uploads folder does not exist: ' + source);
  await mkdir(backupDir, { recursive: true, mode: 0o700 });

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const name = 'hola-maps-media-' + stamp + '.tar.gz';
  const temporary = path.join(backupDir, '.' + name + '.tmp');
  const destination = path.join(backupDir, name);
  try {
    await run('tar', ['-czf', temporary, '-C', path.dirname(source), path.basename(source)]);
    await run('tar', ['-tzf', temporary]);
    await rename(temporary, destination);
    const digest = await checksum(destination);
    await writeFile(destination + '.sha256', digest + '  ' + name + '\n', { mode: 0o600 });

    const cutoff = Date.now() - retentionDays * 86400000;
    for (const candidate of await readdir(backupDir)) {
      if (!/^hola-maps-media-\d{8}T\d{6}Z\.tar\.gz(\.sha256)?$/.test(candidate)) continue;
      const backupDate = candidate.match(/(\d{8}T\d{6}Z)/)?.[1];
      if (!backupDate) continue;
      const y = backupDate.slice(0, 4);
      const m = backupDate.slice(4, 6);
      const d = backupDate.slice(6, 8);
      const h = backupDate.slice(9, 11);
      const minute = backupDate.slice(11, 13);
      const sec = backupDate.slice(13, 15);
      const stampMs = Date.parse(y + '-' + m + '-' + d + 'T' + h + ':' + minute + ':' + sec + 'Z');
      if (Number.isFinite(stampMs) && stampMs < cutoff) {
        await rm(path.join(backupDir, candidate), { force: true });
      }
    }
    console.log('[backup] verified local media archive:', destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

main().catch((err) => {
  console.error('[media-backup]', err.message);
  process.exitCode = 1;
});

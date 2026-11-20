import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const script = path.resolve(process.cwd(), 'src/scripts/backupMedia.js');

test('media snapshot creates a readable archive and accurate SHA256 manifest', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'hola-backup-test-'));
  const source = path.join(temp, 'uploads');
  const backupDir = path.join(temp, 'backups');

  try {
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'example.txt'), 'backed up media bytes', { mode: 0o600 });
    await run(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        UPLOAD_PROVIDER: 'local',
        UPLOAD_DIR: source,
        BACKUP_DIR: backupDir
      }
    });

    const names = await readdir(backupDir);
    const archiveName = names.find((name) => /^hola-maps-media-.*\.tar\.gz$/.test(name));
    assert.ok(archiveName, 'missing .tar.gz file');
    const archivePath = path.join(backupDir, archiveName);
    const bytes = await readFile(archivePath);
    const manifest = await readFile(archivePath + '.sha256', 'utf8');
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(manifest.trim(), digest + '  ' + archiveName);
    const { stdout } = await run('tar', ['-tzf', archivePath]);
    assert.match(stdout, /uploads\/example\.txt/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('Cloudinary media backups fail closed rather than making an empty local archive', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'hola-backup-provider-'));
  try {
    await assert.rejects(
      run(process.execPath, [script], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          UPLOAD_PROVIDER: 'cloudinary',
          BACKUP_DIR: temp
        }
      }),
      (error) => error.code !== 0
    );
    const names = await readdir(temp);
    assert.deepEqual(names, []);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const installer = path.join(root, 'scripts', 'install-backup-cron.sh');
const isUnix = process.platform !== 'win32';

test('backup installer fails closed when crontab is unavailable', { skip: !isUnix }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hola-no-cron-'));
  try {
    const result = spawnSync('/bin/bash', [installer], {
      env: { PATH: dir, APP_DIR: dir }, encoding: 'utf8'
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /crontab is unavailable|not installed/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('backup installer replaces only its own job and preserves other entries', { skip: !isUnix }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hola-test-cron-'));
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const state = path.join(dir, 'crontab.txt');
  writeFileSync(state, '*/5 * * * * echo keep-other-schedule\n');
  const stub = path.join(bin, 'crontab');
  writeFileSync(stub, `#!/bin/sh
if [ "$1" = "-l" ]; then cat "$CRON_STUB_STATE"; exit 0; fi
if [ "$1" = "-" ]; then cat > "$CRON_STUB_STATE"; exit 0; fi
exit 2
`, { mode: 0o755 });
  try {
    const env = {
      ...process.env, PATH: bin + ':/usr/bin:/bin',
      APP_DIR: path.join(dir, 'app'), CRON_STUB_STATE: state
    };
    for (let i = 0; i < 2; i++) {
      const result = spawnSync('/bin/bash', [installer], { env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const content = readFileSync(state, 'utf8');
    assert.equal(content.match(/HOLA_MAPS_NIGHTLY_BACKUP/g)?.length, 1);
    assert.match(content, /keep-other-schedule/);
    assert.match(content, /npm run db:backup/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('backup installer rejects shell-ambiguous APP_DIR rather than writing cron', { skip: !isUnix }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hola-bad-dir-'));
  try {
    const result = spawnSync('/bin/bash', [installer], {
      env: { PATH: '/usr/bin:/bin', APP_DIR: dir + '/space in path' }, encoding: 'utf8'
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APP_DIR contains unsupported characters/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

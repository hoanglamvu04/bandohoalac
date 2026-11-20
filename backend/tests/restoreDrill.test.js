import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertSafeRestoreTarget,
  verifyDumpWithChecksum
} from '../src/scripts/restoreDrill.js';

const source = 'postgresql://postgres:local@localhost:5432/hola_maps';
const target = 'postgresql://postgres:local@localhost:5432/hola_restore_ci_check';
const confirmation = 'RESTORE_IN_EMPTY_HOLA_RESTORE_DB';

test('restore drill refuses missing confirmation and production target', () => {
  assert.throws(() => assertSafeRestoreTarget(source, target, ''), /confirmation|required/i);
  assert.throws(() => assertSafeRestoreTarget(source, source, confirmation), /Target database name|production/i);
  assert.throws(() => assertSafeRestoreTarget(source,
    'postgresql://postgres:local@localhost:5432/postgres', confirmation), /Target database name/i);
  assert.throws(() => assertSafeRestoreTarget(source,
    'postgresql://postgres:local@localhost:5432/hola_restore_foo-bar', confirmation), /Target database name/i);
  assert.equal(assertSafeRestoreTarget(source, target, confirmation).targetDb, 'hola_restore_ci_check');
});

test('backup manifest requires matching name and SHA256 before restore', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'hola-drill-test-'));
  const name = 'hola-maps-20261120T071500Z.dump';
  const filename = path.join(tmp, name);
  const contents = Buffer.from('safe backup test fixture');
  try {
    await writeFile(filename, contents);
    const hash = createHash('sha256').update(contents).digest('hex');
    await writeFile(filename + '.sha256', hash + '  ' + name + '\n');
    assert.equal(await verifyDumpWithChecksum(tmp), filename);
    await writeFile(filename, Buffer.from('tampered backup'));
    await assert.rejects(verifyDumpWithChecksum(tmp), /SHA256/i);
    await writeFile(filename, contents);
    await writeFile(filename + '.sha256', hash + '  wrong.dump\n');
    await assert.rejects(verifyDumpWithChecksum(tmp), /manifest/i);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

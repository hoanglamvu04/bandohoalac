import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { registerTemporaryUploadCleanup } from '../src/middleware/upload.js';

async function fileExists(filename) {
  try { await access(filename); return true; } catch { return false; }
}

async function waitForRemoval(filename) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!(await fileExists(filename))) return;
    await delay(10);
  }
  assert.fail('uploaded temporary original was not removed: ' + filename);
}

function response(statusCode, writableEnded = true) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.writableEnded = writableEnded;
  return res;
}

test('failed validation cleans disk files that multer already accepted', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hola-upload-cleanup-'));
  try {
    const a = path.join(root, randomUUID() + '.jpg');
    const b = path.join(root, randomUUID() + '.png');
    await Promise.all([writeFile(a, 'raw-A'), writeFile(b, 'raw-B')]);
    const res = response(422);
    registerTemporaryUploadCleanup({ files: [{ path: a }, { path: b }] }, res);
    res.emit('finish');
    await Promise.all([waitForRemoval(a), waitForRemoval(b)]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('successful handlers are not accidentally stripped of their local files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hola-upload-success-'));
  try {
    const filename = path.join(root, randomUUID() + '.png');
    await writeFile(filename, 'temporary');
    const res = response(201);
    registerTemporaryUploadCleanup({ file: { path: filename } }, res);
    res.emit('finish');
    await delay(30);
    assert.equal(await fileExists(filename), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('client disconnect cleans abandoned incoming upload files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hola-upload-disconnect-'));
  try {
    const filename = path.join(root, randomUUID() + '.webp');
    await writeFile(filename, 'temporary');
    const res = response(200, false);
    registerTemporaryUploadCleanup({ file: { path: filename } }, res);
    res.emit('close');
    await waitForRemoval(filename);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

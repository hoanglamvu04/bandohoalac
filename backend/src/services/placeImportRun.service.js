import { spawn } from 'node:child_process';
import { access, readFile, unlink } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import { SERVICE_AREA_BOUNDS } from '../config/mapCoverage.js';
import { AppError } from '../utils/AppError.js';
import { stageOvertureFeatures } from './placeImport.service.js';
import { publishFoundationPois } from './foundationPoi.service.js';

const SOURCE = 'OVERTURE';
const STALE_AFTER_HOURS = 2;
const MAX_LOG_CHARS = 5000;
const SCAN_MODES = new Set(['STAGING', 'FOUNDATION']);

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.55;
  return Math.min(Math.max(n, 0), 1);
}

function normalizeScanMode(value) {
  const mode = String(value || 'STAGING').trim().toUpperCase();
  return SCAN_MODES.has(mode) ? mode : 'STAGING';
}

function mapRun(row) {
  if (!row) return null;
  const logExcerpt = row.log_excerpt || null;
  return {
    id: String(row.id),
    source: row.source,
    status: row.status,
    bbox: row.bbox,
    minConfidence: Number(row.min_confidence),
    received: Number(row.received_count) || 0,
    staged: Number(row.staged_count) || 0,
    new: Number(row.new_count) || 0,
    review: Number(row.review_count) || 0,
    duplicates: Number(row.duplicate_count) || 0,
    skipped: Number(row.skipped_count) || 0,
    startedBy: row.started_by ? String(row.started_by) : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message || null,
    logExcerpt,
    scanMode: logExcerpt?.includes('MODE: FOUNDATION') ? 'FOUNDATION' : 'STAGING',
    createdAt: row.created_at
  };
}

async function expireStaleRuns() {
  await pool.query(
    `UPDATE place_import_runs
     SET status = 'FAILED',
         finished_at = NOW(),
         error_message = COALESCE(error_message, 'Scan was interrupted before completion.')
     WHERE source = $1
       AND status IN ('QUEUED','RUNNING')
       AND COALESCE(started_at, created_at) < NOW() - ($2::text || ' hours')::interval`,
    [SOURCE, String(STALE_AFTER_HOURS)]
  );
}

export async function listPlaceImportRuns({ limit = 12 } = {}) {
  await expireStaleRuns();
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const { rows } = await pool.query(
    `SELECT *
     FROM place_import_runs
     WHERE source = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [SOURCE, safeLimit]
  );
  return rows.map(mapRun);
}

async function existingActiveRun() {
  const { rows } = await pool.query(
    `SELECT *
     FROM place_import_runs
     WHERE source = $1
       AND status IN ('QUEUED','RUNNING')
     ORDER BY created_at DESC
     LIMIT 1`,
    [SOURCE]
  );
  return mapRun(rows[0]);
}

function cliCandidates() {
  const values = [
    env.overtureCliPath,
    '/opt/overture-venv/bin/overturemaps',
    '/usr/local/bin/overturemaps',
    '/usr/bin/overturemaps',
    process.platform === 'win32' ? 'overturemaps.exe' : 'overturemaps'
  ];
  return [...new Set(values.filter(Boolean))];
}

async function pathExists(candidate) {
  if (!candidate.includes('/') && !candidate.includes('\\')) return true;
  try {
    await access(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    const append = (current, chunk) =>
      (current + String(chunk || '')).slice(-MAX_LOG_CHARS);

    child.stdout?.on('data', (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = append(stderr, chunk);
    });

    child.once('error', (error) => {
      reject(Object.assign(error, { stdout, stderr }));
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(
        'Overture CLI exited with code ' + code +
        (stderr.trim() ? ': ' + stderr.trim().slice(-1200) : '')
      );
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function downloadOvertureGeoJson(outputFile, bbox) {
  const args = [
    'download',
    '--bbox=' + bbox,
    '-f', 'geojson',
    '--type=place',
    '-o', outputFile
  ];

  let lastError = null;

  for (const candidate of cliCandidates()) {
    if (!(await pathExists(candidate))) continue;
    try {
      const result = await runCommand(candidate, args);
      return { ...result, command: candidate };
    } catch (error) {
      lastError = error;
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  throw new Error(
    'Không tìm thấy overturemaps CLI. Cài vào /opt/overture-venv hoặc đặt OVERTURE_CLI_PATH.' +
    (lastError?.message ? ' ' + lastError.message : '')
  );
}

async function updateRun(runId, fields) {
  const mapping = {
    status: 'status',
    received: 'received_count',
    staged: 'staged_count',
    new: 'new_count',
    review: 'review_count',
    duplicates: 'duplicate_count',
    skipped: 'skipped_count',
    errorMessage: 'error_message',
    logExcerpt: 'log_excerpt'
  };

  const clauses = [];
  const params = [];

  for (const [key, column] of Object.entries(mapping)) {
    if (fields[key] === undefined) continue;
    params.push(fields[key]);
    clauses.push(column + ' = $' + params.length);
  }

  if (fields.startedAtNow) clauses.push('started_at = NOW()');
  if (fields.finishedAtNow) clauses.push('finished_at = NOW()');

  if (!clauses.length) return;

  params.push(Number(runId));
  await pool.query(
    'UPDATE place_import_runs SET ' + clauses.join(', ') + ' WHERE id = $' + params.length,
    params
  );
}

async function executeOvertureRun(runId, minConfidence, bbox, scanMode, startedBy) {
  const outputFile = path.join(os.tmpdir(), 'hola-overture-places-' + runId + '.geojson');

  try {
    await updateRun(runId, {
      status: 'RUNNING',
      startedAtNow: true,
      errorMessage: null,
      logExcerpt: 'MODE: ' + scanMode
    });

    const download = await downloadOvertureGeoJson(outputFile, bbox);
    const raw = await readFile(outputFile, 'utf8');
    const document = JSON.parse(raw);
    const features = Array.isArray(document?.features) ? document.features : [];

    if (!features.length) {
      throw new Error('Overture scan returned no GeoJSON features.');
    }

    const stats = await stageOvertureFeatures(features, { minConfidence });
    const foundation = scanMode === 'FOUNDATION'
      ? await publishFoundationPois({ reviewerId: startedBy, limit: 1200 })
      : null;

    await updateRun(runId, {
      status: 'SUCCESS',
      received: stats.received,
      staged: stats.staged,
      new: stats.new,
      review: stats.review,
      duplicates: stats.duplicates,
      skipped: stats.skipped,
      logExcerpt: [
        'MODE: ' + scanMode,
        foundation
          ? 'FOUNDATION_PUBLISHED: ' + foundation.approvedCount +
            ' | POLICY_SKIPPED: ' + foundation.skippedByPolicyCount +
            ' | FAILED: ' + foundation.failedCount
          : null,
        'CLI: ' + download.command,
        download.stdout?.trim(),
        download.stderr?.trim()
      ].filter(Boolean).join('\n').slice(-MAX_LOG_CHARS),
      finishedAtNow: true
    });
  } catch (error) {
    await updateRun(runId, {
      status: 'FAILED',
      errorMessage: String(error?.message || error).slice(0, 3000),
      logExcerpt: [
        'MODE: ' + scanMode,
        String(error?.stderr || error?.stdout || '')
      ].filter(Boolean).join('\n').slice(-MAX_LOG_CHARS),
      finishedAtNow: true
    });
  } finally {
    await unlink(outputFile).catch(() => {});
  }
}

export async function startOverturePlaceScan({
  startedBy,
  minConfidence = 0.55,
  mode = 'STAGING'
} = {}) {
  await expireStaleRuns();

  const active = await existingActiveRun();
  if (active) {
    throw new AppError('Đang có một lần quét Overture chạy.', 409, { run: active });
  }

  const threshold = clampConfidence(minConfidence);
  const scanMode = normalizeScanMode(mode);
  const bbox = SERVICE_AREA_BOUNDS.join(',');

  let row;
  try {
    const result = await pool.query(
      `INSERT INTO place_import_runs (
         source, status, bbox, min_confidence, started_by, log_excerpt
       )
       VALUES ($1, 'QUEUED', $2, $3, $4, $5)
       RETURNING *`,
      [SOURCE, bbox, threshold, startedBy || null, 'MODE: ' + scanMode]
    );
    row = result.rows[0];
  } catch (error) {
    if (error?.code === '23505') {
      const current = await existingActiveRun();
      throw new AppError('Đang có một lần quét Overture chạy.', 409, { run: current });
    }
    throw error;
  }

  setImmediate(() => {
    executeOvertureRun(row.id, threshold, bbox, scanMode, startedBy).catch((error) => {
      console.error('[Hola Maps] background Overture scan failed:', error);
    });
  });

  return {
    ...mapRun(row),
    scanMode
  };
}

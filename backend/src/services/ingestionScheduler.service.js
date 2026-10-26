import { env } from '../config/env.js';
import {
  dispatchDueIngestionSources,
  reconcileIngestionJobs
} from './ingestion.service.js';

let timer = null;
let bootTimer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await reconcileIngestionJobs();
    await dispatchDueIngestionSources();
  } catch (error) {
    console.error('[Hola Maps] ingestion scheduler tick failed:', error?.message || error);
  } finally {
    running = false;
  }
}

export function startIngestionScheduler() {
  if (!env.ingestionAutomationEnabled || env.nodeEnv === 'test') {
    return () => {};
  }

  if (timer || bootTimer) {
    return stopIngestionScheduler;
  }

  const intervalMs = env.ingestionSchedulerIntervalMs;
  bootTimer = setTimeout(() => {
    bootTimer = null;
    tick().catch(() => {});
  }, 15_000);
  bootTimer.unref?.();

  timer = setInterval(() => {
    tick().catch(() => {});
  }, intervalMs);
  timer.unref?.();

  console.log(
    '[Hola Maps] Auto ingestion scheduler enabled every ' +
    Math.round(intervalMs / 60000) +
    ' minute(s).'
  );

  return stopIngestionScheduler;
}

export function stopIngestionScheduler() {
  if (bootTimer) clearTimeout(bootTimer);
  if (timer) clearInterval(timer);
  bootTimer = null;
  timer = null;
}

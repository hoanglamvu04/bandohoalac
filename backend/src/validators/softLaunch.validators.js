import { z } from 'zod';

export const feedbackSubmitSchema = z.object({
  category: z.enum(['BUG', 'DATA', 'UX', 'SUGGESTION']),
  area: z.enum(['MAP', 'PLACE', 'HOUSING', 'SEARCH', 'ACCOUNT', 'OTHER']),
  message: z.string().trim().min(20).max(1200),
  // Honeypot is intentionally optional and never persisted.
  website: z.string().max(120).optional().default('')
}).strict();

export const feedbackListSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict();

export const feedbackReviewSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']),
  note: z.string().trim().max(1000).nullable().optional()
}).strict();

export const vitalSampleSchema = z.object({
  metric: z.enum(['LCP', 'INP', 'CLS', 'MAP_READY']),
  routeGroup: z.enum(['HOME', 'MAP', 'PLACE', 'HOUSING', 'EXPLORE', 'OTHER']),
  device: z.enum(['MOBILE', 'DESKTOP']),
  network: z.enum(['slow-2g', '2g', '3g', '4g', 'unknown']),
  value: z.number().finite().nonnegative().max(120000)
}).strict().superRefine((item, ctx) => {
  if (item.metric === 'CLS' && item.value > 5) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'CLS must be <= 5.' });
  }
  if (item.metric === 'MAP_READY' && item.routeGroup !== 'MAP') {
    ctx.addIssue({ code: 'custom', path: ['routeGroup'], message: 'Map readiness must use MAP.' });
  }
});

export const VITAL_THRESHOLDS = Object.freeze({
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  MAP_READY: [3500, 6000]
});

export function gradeVital(metric, value) {
  const thresholds = VITAL_THRESHOLDS[metric];
  if (!thresholds || !Number.isFinite(value) || value < 0) return null;
  return value <= thresholds[0]
    ? 'good'
    : value <= thresholds[1] ? 'needs_improvement' : 'poor';
}

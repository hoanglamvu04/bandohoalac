import { z } from 'zod';

const appName = z.string().trim().min(2).max(120);
const email = z.string().trim().email().max(254);
const origin = z.string().trim().min(8).max(250).refine((raw) => {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return false;
    if (url.protocol === 'https:') return true;
    return (
      process.env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}, 'Chỉ chấp nhận origin HTTPS cụ thể, không có path, wildcard hoặc query.');

const origins = z.array(origin).min(1).max(10);

export const embedRequestSchema = z.object({
  appName,
  contactEmail: email,
  origins,
  note: z.string().trim().max(1000).optional().nullable()
}).strict();

export const adminCreateEmbedSchema = z.object({
  appName,
  contactEmail: email,
  origins,
  note: z.string().trim().max(1000).optional().nullable(),
  validDays: z.coerce.number().int().min(1).max(730).default(365)
}).strict();

export const adminApproveEmbedSchema = z.object({
  approvedOrigins: origins.optional(),
  validDays: z.coerce.number().int().min(1).max(730).default(365)
}).strict();

export const adminRejectEmbedSchema = z.object({
  reason: z.string().trim().min(5).max(1000)
}).strict();

export const adminRotateEmbedSchema = z.object({
  validDays: z.coerce.number().int().min(1).max(730).default(365)
}).strict();

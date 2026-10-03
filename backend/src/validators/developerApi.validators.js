import { z } from 'zod';

const originSchema = z.string().trim().url().max(240);
const permissionSchema = z.string().trim().min(1).max(80);

export const updateDeveloperApiSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  accessMode: z.enum(['OPEN', 'PARTNER']).optional(),
  docsEnabled: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one setting is required.'
});

export const createDeveloperApiClientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  allowedOrigins: z.array(originSchema).max(20).default([]),
  permissions: z.array(permissionSchema).max(30).default(['*']),
  rateLimitPerMinute: z.coerce.number().int().min(30).max(600).default(300),
  note: z.string().trim().max(1000).optional().nullable()
});

export const updateDeveloperApiClientSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  allowedOrigins: z.array(originSchema).max(20).optional(),
  permissions: z.array(permissionSchema).max(30).optional(),
  rateLimitPerMinute: z.coerce.number().int().min(30).max(600).optional(),
  note: z.string().trim().max(1000).optional().nullable()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one client field is required.'
});

export const createDeveloperApiKeySchema = z.object({
  clientId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120).optional(),
  expiresAt: z.string().datetime().optional().nullable()
});

export const updateDeveloperApiEndpointSchema = z.object({
  enabled: z.boolean().optional(),
  requiresKey: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one endpoint field is required.'
});

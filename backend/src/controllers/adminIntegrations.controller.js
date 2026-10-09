import { asyncHandler } from '../utils/asyncHandler.js';
import {
  deleteIntegrationSecret,
  listIntegrationProviders,
  saveIntegrationSecret,
  testIntegrationSecret
} from '../services/integrationSecrets.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

async function audit(req, action, provider, metadata = {}) {
  await writeAuditLog({
    actorUserId: req.user.id,
    action,
    entityType: 'INTEGRATION_SECRET',
    entityId: String(provider || '').toUpperCase(),
    metadata,
    ...auditContextFromRequest(req)
  });
}

export const listIntegrationsAdmin = asyncHandler(async (_req, res) => {
  res.json({ items: await listIntegrationProviders() });
});

export const testIntegrationAdmin = asyncHandler(async (req, res) => {
  const result = await testIntegrationSecret(req.params.provider, {
    secret: req.body?.secret
  });

  await audit(req, 'INTEGRATION_SECRET_TESTED', result.provider, {
    ok: result.ok,
    source: result.source,
    statusCode: result.statusCode || null,
    latencyMs: result.latencyMs || null
  });

  res.json(result);
});

export const saveIntegrationAdmin = asyncHandler(async (req, res) => {
  const item = await saveIntegrationSecret(
    req.params.provider,
    req.body?.secret,
    req.user.id
  );

  await audit(req, 'INTEGRATION_SECRET_SAVED', item.provider, {
    configured: item.configured,
    source: item.source,
    masked: item.masked,
    lastTestStatus: item.lastTestStatus
  });

  res.json({ ok: true, item });
});

export const deleteIntegrationAdmin = asyncHandler(async (req, res) => {
  const item = await deleteIntegrationSecret(req.params.provider);

  await audit(req, 'INTEGRATION_SECRET_DELETED', item.provider, {
    fallbackActive: item.configured,
    fallbackSource: item.source
  });

  res.json({ ok: true, item });
});

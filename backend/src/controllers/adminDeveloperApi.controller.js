import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createDeveloperApiClient,
  createDeveloperApiKey,
  getDeveloperApiOverview,
  listDeveloperApiClients,
  listDeveloperApiEndpoints,
  listDeveloperApiKeys,
  listDeveloperApiUsageLogs,
  revokeDeveloperApiKey,
  updateDeveloperApiClient,
  updateDeveloperApiEndpoint,
  updateDeveloperApiSettings
} from '../services/developerApi.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

async function audit(req, action, entityType, entityId, metadata = {}) {
  await writeAuditLog({
    actorUserId: req.user.id,
    action,
    entityType,
    entityId,
    metadata,
    ...auditContextFromRequest(req)
  });
}

export const getDeveloperApiOverviewAdmin = asyncHandler(async (_req, res) => {
  res.json(await getDeveloperApiOverview());
});

export const updateDeveloperApiSettingsAdmin = asyncHandler(async (req, res) => {
  const settings = await updateDeveloperApiSettings(req.body, req.user.id);
  await audit(req, 'DEVELOPER_API_SETTINGS_UPDATED', 'DEVELOPER_API', 'settings', req.body);
  res.json(settings);
});

export const listDeveloperApiClientsAdmin = asyncHandler(async (_req, res) => {
  res.json({ items: await listDeveloperApiClients() });
});

export const createDeveloperApiClientAdmin = asyncHandler(async (req, res) => {
  const item = await createDeveloperApiClient(req.body, req.user.id);
  await audit(req, 'DEVELOPER_API_CLIENT_CREATED', 'DEVELOPER_API_CLIENT', item.id, {
    name: item.name,
    allowedOrigins: item.allowedOrigins
  });
  res.status(201).json(item);
});

export const updateDeveloperApiClientAdmin = asyncHandler(async (req, res) => {
  const item = await updateDeveloperApiClient(Number(req.params.id), req.body, req.user.id);
  await audit(req, 'DEVELOPER_API_CLIENT_UPDATED', 'DEVELOPER_API_CLIENT', item.id, req.body);
  res.json(item);
});

export const listDeveloperApiKeysAdmin = asyncHandler(async (req, res) => {
  res.json({ items: await listDeveloperApiKeys(req.query.clientId) });
});

export const createDeveloperApiKeyAdmin = asyncHandler(async (req, res) => {
  const item = await createDeveloperApiKey(req.body, req.user.id);
  await audit(req, 'DEVELOPER_API_KEY_CREATED', 'DEVELOPER_API_KEY', item.id, {
    clientId: item.clientId,
    name: item.name,
    prefix: item.prefix,
    last4: item.last4
  });
  res.status(201).json(item);
});

export const revokeDeveloperApiKeyAdmin = asyncHandler(async (req, res) => {
  const item = await revokeDeveloperApiKey(Number(req.params.id));
  await audit(req, 'DEVELOPER_API_KEY_REVOKED', 'DEVELOPER_API_KEY', item.id, {
    clientId: item.clientId,
    name: item.name
  });
  res.json(item);
});

export const listDeveloperApiEndpointsAdmin = asyncHandler(async (_req, res) => {
  res.json({ items: await listDeveloperApiEndpoints() });
});

export const updateDeveloperApiEndpointAdmin = asyncHandler(async (req, res) => {
  const item = await updateDeveloperApiEndpoint(req.params.key, req.body, req.user.id);
  await audit(req, 'DEVELOPER_API_ENDPOINT_UPDATED', 'DEVELOPER_API_ENDPOINT', item.key, req.body);
  res.json(item);
});

export const listDeveloperApiLogsAdmin = asyncHandler(async (req, res) => {
  res.json({ items: await listDeveloperApiUsageLogs(req.query) });
});

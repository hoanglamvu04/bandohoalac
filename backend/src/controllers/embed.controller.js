import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listOwnEmbeds,
  policyForEmbedUri,
  requestEmbed
} from '../services/embedPlatform.service.js';

export const checkEmbedAuthorization = asyncHandler(async (req, res) => {
  // X-Original-URI is supplied by the internal Nginx auth_request subrequest.
  // This endpoint NEVER trusts Referer/Origin as proof of iframe parent identity:
  // the browser enforces the returned frame-ancestors policy.
  const uri = req.get('x-original-uri') || '';
  const origins = await policyForEmbedUri(uri);
  res.set('X-Hola-Embed-Allowed-Origins', origins.join(' '));
  res.set('Cache-Control', 'no-store');
  res.status(204).end();
});

export const submitEmbedRequest = asyncHandler(async (req, res) => {
  const result = await requestEmbed({
    userId: req.user.id,
    ...req.body
  });
  res.set('Cache-Control', 'private, no-store').status(201).json({ item: result });
});

export const getMyEmbedRequests = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ items: await listOwnEmbeds(req.user.id) });
});

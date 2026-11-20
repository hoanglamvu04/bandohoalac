import { asyncHandler } from '../utils/asyncHandler.js';
import {
  submitSoftLaunchFeedback, listSoftLaunchFeedback, reviewSoftLaunchFeedback,
  recordSoftLaunchVital, softLaunchVitalsOverview
} from '../services/softLaunchV1.service.js';

export const submitFeedback = asyncHandler(async (req, res) => {
  const result = await submitSoftLaunchFeedback(req.body);
  res.set('Cache-Control', 'no-store');
  res.status(201).json(result);
});

export const submitVital = asyncHandler(async (req, res) => {
  await recordSoftLaunchVital(req.body);
  res.set('Cache-Control', 'no-store');
  res.status(204).end();
});

export const adminListFeedback = asyncHandler(async (req, res) => {
  const result = await listSoftLaunchFeedback(req.query);
  res.set('Cache-Control', 'private, no-store');
  res.json(result);
});

export const adminReviewFeedback = asyncHandler(async (req, res) => {
  const result = await reviewSoftLaunchFeedback(req.params.id, req.body, req.user.id);
  res.set('Cache-Control', 'private, no-store');
  res.json(result);
});

export const adminVitalOverview = asyncHandler(async (_req, res) => {
  const result = await softLaunchVitalsOverview();
  res.set('Cache-Control', 'private, no-store');
  res.json(result);
});

import { asyncHandler } from '../utils/asyncHandler.js';
import {
  compareHousingListings, listSavedHousingSearches, saveHousingSearch,
  setSavedHousingSearchEnabled, deleteSavedHousingSearch
} from '../services/housingIntelligence.service.js';

export const compareHousing = asyncHandler(async (req, res) => {
  const ids = req.query.ids.split(',');
  const result = await compareHousingListings(ids);
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30');
  res.json(result);
});

export const listMySavedHousingSearches = asyncHandler(async (req, res) => {
  const items = await listSavedHousingSearches(req.user.id);
  res.set('Cache-Control', 'private, no-store');
  res.json({ items });
});

export const createMySavedHousingSearch = asyncHandler(async (req, res) => {
  const item = await saveHousingSearch(req.user.id, req.body);
  res.set('Cache-Control', 'private, no-store');
  res.status(201).json({ item });
});

export const toggleMySavedHousingSearch = asyncHandler(async (req, res) => {
  const item = await setSavedHousingSearchEnabled(
    req.user.id, req.params.id, req.body.enabled
  );
  res.set('Cache-Control', 'private, no-store');
  res.json({ item });
});

export const removeMySavedHousingSearch = asyncHandler(async (req, res) => {
  const result = await deleteSavedHousingSearch(req.user.id, req.params.id);
  res.set('Cache-Control', 'private, no-store');
  res.json(result);
});

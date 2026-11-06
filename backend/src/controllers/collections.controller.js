import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addPlaceToCollection,
  createCollection,
  deleteCollection,
  getCollectionBySlug,
  listMyCollections,
  listPublicCollections,
  removePlaceFromCollection,
  updateCollection
} from '../services/collection.service.js';

export const getMine = asyncHandler(async (req, res) => {
  const items = await listMyCollections(req.user.id, {
    placeId: req.query.placeId,
    limit: req.query.limit,
    offset: req.query.offset
  });
  res.json({ items });
});

export const discover = asyncHandler(async (req, res) => {
  const items = await listPublicCollections({
    limit: req.query.limit,
    offset: req.query.offset
  });
  res.json({ items });
});

export const getBySlug = asyncHandler(async (req, res) => {
  const result = await getCollectionBySlug(req.params.slug, req.user?.id || null);
  res.json(result);
});

export const create = asyncHandler(async (req, res) => {
  const result = await createCollection(req.user.id, req.body);
  res.status(201).json(result);
});

export const update = asyncHandler(async (req, res) => {
  const result = await updateCollection(Number(req.params.id), req.user.id, req.body);
  res.json(result);
});

export const remove = asyncHandler(async (req, res) => {
  await deleteCollection(Number(req.params.id), req.user.id);
  res.status(204).end();
});

export const addItem = asyncHandler(async (req, res) => {
  const result = await addPlaceToCollection(
    Number(req.params.id),
    req.user.id,
    Number(req.body.placeId)
  );
  res.status(result.added ? 201 : 200).json(result);
});

export const removeItem = asyncHandler(async (req, res) => {
  const result = await removePlaceFromCollection(
    Number(req.params.id),
    req.user.id,
    Number(req.params.placeId)
  );
  res.json(result);
});
